// Job creation and the detect stage.
//   createJob: store the photo, insert the job row (status uploaded)
//   runDetect: list + segment, upload masks and cutouts, insert items, status awaiting_confirm
// Runs after the upload response is sent (next/server `after`), so the user sees progress live.

import "server-only";
import { BudgetError, resumeJob, startJob, type JobBudget } from "../budget";
import { round } from "../cost";
import { hash } from "../cache";
import { config } from "../env";
import { createLogger, errorMessage } from "../log";
import { detectItems } from "../pipeline/detect";
import { cropPng, maskPng } from "../pipeline/masks";
import { photoFromBuffer, type Photo } from "../pipeline/photo";
import { supabaseAdmin } from "../supabase/server";
import { downloadFile, uploadFile } from "../supabase/storage";
import type { TemplateId } from "../templates";
import { failJob, jobCostTotal, paths, recordJobCost } from "./shared";

const log = createLogger("jobs:detect");

export async function createJob(photo: Photo, template: TemplateId): Promise<string> {
  const db = supabaseAdmin();
  const { data: job, error } = await db.from("jobs").insert({ template, status: "uploaded", photo_hash: photo.hash }).select("id").single();
  if (error || !job) throw new Error(`could not create job: ${error?.message}`);
  await uploadFile("photos", paths.photo(job.id), photo.bytes, "image/jpeg");
  await db.from("jobs").update({ photo_path: paths.photo(job.id) }).eq("id", job.id);
  log.info("job created", { job: job.id, template, width: photo.width, height: photo.height });
  return job.id;
}

/** The job row already exists, so it counts itself toward the daily cap. */
export async function checkCanStart(): Promise<JobBudget> {
  return startJob("pending", { recordStart: false });
}

export async function runDetect(jobId: string, photo?: Photo): Promise<void> {
  const db = supabaseAdmin();
  const started = performance.now();
  let job: JobBudget | undefined;
  try {
    const { data: row, error } = await db.from("jobs").select("id, photo_path, cost").eq("id", jobId).single();
    if (error || !row?.photo_path) throw new Error(`job ${jobId} not found`);
    job = resumeJob(jobId, jobCostTotal(row.cost));
    photo ??= await photoFromBuffer(await downloadFile("photos", row.photo_path));

    await db.from("jobs").update({ status: "listing" }).eq("id", jobId);
    const result = await detectItems(photo, job, config().MAX_ITEMS_PER_JOB);
    await db.from("jobs").update({ status: "segmenting" }).eq("id", jobId);

    // masks + cutouts to storage, then one insert so the detect screen gets every item at once
    const rows = [];
    for (const m of result.items) {
      const [mask, crop] = await Promise.all([maskPng(m.match, photo.width, photo.height), cropPng(photo.bytes, m.match, photo.width, photo.height)]);
      await Promise.all([
        uploadFile("masks", paths.mask(jobId, m.index), mask, "image/png"),
        uploadFile("crops", paths.crop(jobId, m.index), crop, "image/png"),
      ]);
      rows.push({
        job_id: jobId,
        idx: m.index,
        name: m.name,
        phrase: m.phrase,
        category: m.category,
        box: {
          ...m.box,
          areaPct: round((m.area / (photo.width * photo.height)) * 100),
          flat: m.flat,
          source: m.source,
          // same photo + same mask box = same 3D input, so a finished model can be reused
          cacheKey: hash("sam3d-v1", photo.hash, JSON.stringify(m.match.bounds)),
        },
        mask_path: paths.mask(jobId, m.index),
        crop_path: paths.crop(jobId, m.index),
        confidence: m.confidence,
        status: "segmented" as const,
      });
    }
    if (rows.length) {
      const { error: insertError } = await db.from("items").insert(rows);
      if (insertError) throw new Error(`could not save items: ${insertError.message}`);
    }

    await recordJobCost(jobId, job, {
      timings: { listMs: result.timings.listMs, segmentMs: result.timings.segmentMs, detectMs: Math.round(performance.now() - started) },
      extra: { lister: result.lister.model, listed: result.lister.listed, dropped: result.dropped, samCalls: result.samCalls, width: photo.width, height: photo.height },
    });
    await db
      .from("jobs")
      .update({
        status: rows.length ? "awaiting_confirm" : "failed",
        user_message: rows.length ? null : "We couldn't find separate items in this photo. Try a top-down shot with a little space between things.",
      })
      .eq("id", jobId);
    log.info("detect done", { job: jobId, items: rows.length, ms: Math.round(performance.now() - started) });
  } catch (err) {
    log.error("detect failed", { job: jobId, error: errorMessage(err) });
    await failJob(jobId, err, job);
    if (!(err instanceof BudgetError)) throw err;
  }
}
