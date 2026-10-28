// 3D stage.
//   submitReconstruction: keep the confirmed items, submit SAM 3D Objects jobs to the fal queue
//     fast  = one request per item (parallel, items finish one by one, $0.02 each)
//     cheap = one request with every mask ($0.02 per photo, finishes all at once, minutes slower)
//   finishRequest: fal result → download GLB → optimize → glbs bucket → item ready (Realtime tells the client)
//   syncJob: polls fal for this job's open requests; local dev path and a backstop for lost webhooks
// Only the submit costs money. Finishing is idempotent, so webhook and sync can both run.

import "server-only";
import pLimit from "p-limit";
import { paid, resumeJob, spendSince, startOfUtcDay, type JobBudget } from "../budget";
import { PRICES } from "../cost";
import { config } from "../env";
import { SAM_3D_OBJECTS, falClient, type Sam3dObjectsInput, type Sam3dObjectsOutput } from "../fal";
import { createLogger, errorMessage } from "../log";
import { optimizeGlb } from "../pipeline/optimize";
import { downloadGlb, glbUrls } from "../pipeline/reconstruct";
import { supabaseAdmin } from "../supabase/server";
import { signedUrl, uploadFile } from "../supabase/storage";
import { failJob, jobCostTotal, paths, recordJobCost } from "./shared";

const log = createLogger("jobs:3d");

export type ReconstructMode = "fast" | "cheap";

function webhookUrl(): string | undefined {
  const origin = config().NEXT_PUBLIC_APP_URL;
  if (!origin || !origin.startsWith("https://") || /localhost|127\.0\.0\.1/.test(origin)) return undefined;
  return `${origin.replace(/\/$/, "")}/api/webhooks/fal`;
}

export async function chooseMode(): Promise<ReconstructMode> {
  const today = await spendSince("fal", startOfUtcDay());
  return today < config().FAST_3D_DAILY_USD ? "fast" : "cheap";
}

export async function submitReconstruction(
  jobId: string,
  keep: number[],
  opts: { renames?: Record<number, string>; mode?: ReconstructMode } = {},
): Promise<{ mode: ReconstructMode; items: number }> {
  const db = supabaseAdmin();
  const { data: row, error } = await db.from("jobs").select("id, status, photo_path, cost, timings").eq("id", jobId).single();
  if (error || !row?.photo_path) throw new Error(`job ${jobId} not found`);
  if (row.status !== "awaiting_confirm") throw new Error(`job ${jobId} is ${row.status}, not awaiting confirmation`);

  const job = resumeJob(jobId, jobCostTotal(row.cost));
  try {
    const { data: all } = await db.from("items").select("id, idx, mask_path, status, fal_request_id, box").eq("job_id", jobId).order("idx");
    const selected = (all ?? []).filter((i) => keep.includes(i.idx));
    const removed = (all ?? []).filter((i) => !keep.includes(i.idx)).map((i) => i.id);
    if (!selected.length) throw new Error("no items selected");
    job.assertItems(selected.length);
    if (removed.length) await db.from("items").delete().in("id", removed);
    for (const [idx, name] of Object.entries(opts.renames ?? {})) {
      const clean = name.trim().slice(0, 60);
      if (clean) await db.from("items").update({ name: clean, user_edited: true }).eq("job_id", jobId).eq("idx", Number(idx));
    }

    // models already built from the same photo and mask are reused for free
    const keyOf = (i: { box: unknown }) => (i.box as { cacheKey?: string } | null)?.cacheKey;
    const keys = selected.map(keyOf).filter((k): k is string => Boolean(k));
    const { data: hits } = keys.length ? await db.from("model_cache").select("key, response").in("key", keys) : { data: [] };
    const cachedGlb = new Map((hits ?? []).map((h) => [h.key, (h.response as { glbPath?: string }).glbPath]));
    const kept = [];
    for (const item of selected) {
      const glb = cachedGlb.get(keyOf(item) ?? "");
      if (glb) await db.from("items").update({ status: "ready", glb_path: glb }).eq("id", item.id);
      else kept.push(item);
    }
    log.info("3d cache", { job: jobId, reused: selected.length - kept.length, toBuild: kept.length });
    if (!kept.length) {
      await db.from("jobs").update({ status: "reconstructing" }).eq("id", jobId);
      await recordJobCost(jobId, job, { timings: { reconstructSubmittedAt: Date.now() }, extra: { mode: "cache" } });
      await completeIfDone(jobId);
      return { mode: "cheap", items: 0 };
    }

    const mode = opts.mode ?? (await chooseMode());
    const imageUrl = await signedUrl("photos", row.photo_path, 6 * 60 * 60);
    const maskUrls = await Promise.all(kept.map((i) => signedUrl("masks", i.mask_path!, 6 * 60 * 60)));
    const hook = webhookUrl();
    const submit = (masks: string[], label: string) => {
      const input: Sam3dObjectsInput = { image_url: imageUrl, mask_urls: masks, seed: 42, export_textured_glb: true };
      return paid(
        { provider: "fal", model: SAM_3D_OBJECTS, estimateUsd: PRICES["fal-sam-3d-objects"], job, label },
        () => falClient().queue.submit(SAM_3D_OBJECTS, { input, webhookUrl: hook }),
      );
    };

    await db.from("jobs").update({ status: "reconstructing" }).eq("id", jobId);
    if (mode === "fast") {
      const limit = pLimit(6);
      await Promise.all(
        kept.map((item, i) =>
          limit(async () => {
            if (item.fal_request_id) return; // never re-submit an item that already has a request
            const { request_id } = await submit([maskUrls[i]!], `3d ${jobId.slice(0, 8)} #${item.idx}`);
            await db.from("items").update({ status: "reconstructing", fal_request_id: request_id }).eq("id", item.id);
          }),
        ),
      );
    } else {
      const { request_id } = await submit(maskUrls, `3d ${jobId.slice(0, 8)} x${kept.length}`);
      await db.from("items").update({ status: "reconstructing", fal_request_id: request_id }).in("id", kept.map((i) => i.id));
    }

    await recordJobCost(jobId, job, {
      timings: { reconstructSubmittedAt: Date.now() },
      extra: { mode, webhook: Boolean(hook) },
    });
    log.info("3d submitted", { job: jobId, mode, items: kept.length, webhook: Boolean(hook) });
    return { mode, items: kept.length };
  } catch (err) {
    await failJob(jobId, err, job);
    throw err;
  }
}

/** Handles one finished fal request: every item that request covers becomes ready (or falls back). */
export async function finishRequest(requestId: string, output?: Sam3dObjectsOutput, failure?: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: items } = await db
    .from("items")
    .select("id, job_id, idx, status, box")
    .eq("fal_request_id", requestId)
    .order("idx");
  if (!items?.length) {
    log.warn("no items for fal request", { requestId });
    return;
  }
  const jobId = items[0]!.job_id;
  const open = items.filter((i) => i.status === "reconstructing");
  if (!open.length) return; // already handled by the webhook or a previous sync

  if (!failure && !output) {
    try {
      output = (await falClient().queue.result(SAM_3D_OBJECTS, { requestId })).data as Sam3dObjectsOutput;
    } catch (err) {
      failure = errorMessage(err);
    }
  }
  const urls = output ? glbUrls(output) : [];

  await Promise.all(
    items.map(async (item, i) => {
      if (item.status !== "reconstructing") return;
      const url = urls[i];
      if (failure || !url) {
        await db.from("items").update({ status: "fallback", fallback: true }).eq("id", item.id);
        log.warn("item fell back to 2.5D", { job: jobId, idx: item.idx, reason: failure ?? "no GLB in result" });
        return;
      }
      try {
        const opt = await optimizeGlb(await downloadGlb(url));
        await uploadFile("glbs", paths.glb(jobId, item.idx), opt.glb, "model/gltf-binary");
        await db.from("items").update({ status: "ready", glb_path: paths.glb(jobId, item.idx) }).eq("id", item.id);
        const key = (item.box as { cacheKey?: string } | null)?.cacheKey;
        if (key) {
          await db
            .from("model_cache")
            .upsert({ key, provider: "fal", model: SAM_3D_OBJECTS, response: { glbPath: paths.glb(jobId, item.idx), requestId } });
        }
      } catch (err) {
        await db.from("items").update({ status: "fallback", fallback: true }).eq("id", item.id);
        log.error("item processing failed", { job: jobId, idx: item.idx, error: errorMessage(err) });
      }
    }),
  );
  await completeIfDone(jobId);
}

async function completeIfDone(jobId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: items } = await db.from("items").select("status").eq("job_id", jobId);
  if (!items?.length || items.some((i) => i.status === "reconstructing" || i.status === "pending")) return;
  const { data: job } = await db.from("jobs").select("timings, status").eq("id", jobId).single();
  if (job?.status === "ready") return;
  const timings = (job?.timings ?? {}) as Record<string, number>;
  const reconstructMs = timings.reconstructSubmittedAt ? Date.now() - timings.reconstructSubmittedAt : undefined;
  await db
    .from("jobs")
    .update({ status: "ready", timings: { ...timings, ...(reconstructMs ? { reconstructMs } : {}) } })
    .eq("id", jobId);
  log.info("job ready", { job: jobId, reconstructMs });
}

/** Polls fal for the job's open requests and finishes the completed ones. Free: no submits. */
export async function syncJob(jobId: string): Promise<{ open: number; finished: number }> {
  const db = supabaseAdmin();
  const { data: items } = await db.from("items").select("fal_request_id").eq("job_id", jobId).eq("status", "reconstructing");
  const requests = [...new Set((items ?? []).map((i) => i.fal_request_id).filter((r): r is string => Boolean(r)))];
  let finished = 0;
  await Promise.all(
    requests.map(async (requestId) => {
      try {
        const status = await falClient().queue.status(SAM_3D_OBJECTS, { requestId, logs: false });
        if (status.status === "COMPLETED") {
          await finishRequest(requestId);
          finished++;
        }
      } catch (err) {
        log.warn("status check failed", { requestId, error: errorMessage(err) });
      }
    }),
  );
  if (!requests.length) await completeIfDone(jobId);
  return { open: requests.length - finished, finished };
}

export type { JobBudget };
