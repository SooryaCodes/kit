// Replay: a photo that has already been through Kit (the sample bag, or the same picture uploaded again)
// reuses that finished job's items, masks and 3D models. The stages are paced like a live run so the
// flow reads the same, but nothing is called and nothing is spent: no listing, no segmentation, no fal.

import "server-only";
import type { Json } from "../database.types";
import { createLogger, errorMessage } from "../log";
import { supabaseAdmin } from "../supabase/server";
import type { TemplateId } from "../templates";

const log = createLogger("jobs:replay");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Newest finished, non-replay job for this exact photo whose items all have a 3D model. */
export async function findReplaySource(photoHash: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data: jobs } = await db
    .from("jobs")
    .select("id")
    .eq("photo_hash", photoHash)
    .eq("status", "ready")
    .is("cost->>replayOf", null)
    .order("created_at", { ascending: false })
    .limit(5);
  for (const job of jobs ?? []) {
    const { data: items } = await db.from("items").select("glb_path").eq("job_id", job.id);
    if (items?.length && items.every((i) => i.glb_path)) return job.id;
  }
  return null;
}

export async function createReplayJob(sourceId: string, template: TemplateId): Promise<string> {
  const db = supabaseAdmin();
  const { data: source, error } = await db.from("jobs").select("photo_hash, photo_path, cost").eq("id", sourceId).single();
  if (error || !source?.photo_path) throw new Error(`replay source ${sourceId} not found`);
  const cost = (source.cost ?? {}) as { width?: number; height?: number };
  const { data: job, error: insertError } = await db
    .from("jobs")
    .insert({
      template,
      status: "uploaded",
      photo_hash: source.photo_hash,
      photo_path: source.photo_path,
      cost: { width: cost.width, height: cost.height, replayOf: sourceId, totalUsd: 0 } as Json,
    })
    .select("id")
    .single();
  if (insertError || !job) throw new Error(`could not create replay job: ${insertError?.message}`);
  log.info("replay created", { job: job.id, source: sourceId });
  return job.id;
}

/** The replay source for a job, or null for a normal job. */
export async function replaySourceOf(jobId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("jobs").select("cost").eq("id", jobId).single();
  const doc = (data?.cost ?? {}) as { replayOf?: string };
  return doc.replayOf ?? null;
}

/** Listing, then segmenting, then the items appear: the same beats the live detect screen shows. */
export async function runReplayDetect(jobId: string): Promise<void> {
  const db = supabaseAdmin();
  try {
    const sourceId = await replaySourceOf(jobId);
    if (!sourceId) throw new Error(`job ${jobId} is not a replay`);
    await sleep(900);
    await db.from("jobs").update({ status: "listing" }).eq("id", jobId);
    await sleep(3200);
    await db.from("jobs").update({ status: "segmenting" }).eq("id", jobId);

    const { data: items, error } = await db
      .from("items")
      .select("idx, name, phrase, category, box, mask_path, crop_path, confidence, brand, model, price, currency, link")
      .eq("job_id", sourceId)
      .order("idx");
    if (error || !items?.length) throw new Error(`replay source ${sourceId} has no items`);
    await sleep(2600);
    const { error: insertError } = await db.from("items").insert(items.map((i) => ({ ...i, job_id: jobId, status: "segmented" as const })));
    if (insertError) throw new Error(`could not save items: ${insertError.message}`);
    await db.from("jobs").update({ status: "awaiting_confirm" }).eq("id", jobId);
    log.info("replay detect done", { job: jobId, items: items.length });
  } catch (err) {
    log.error("replay detect failed", { job: jobId, error: errorMessage(err) });
    await db
      .from("jobs")
      .update({ status: "failed", error: errorMessage(err).slice(0, 500), user_message: "Something went wrong while building your products. Please try again." })
      .eq("id", jobId);
  }
}

/** Confirm for a replay: keep and rename like a live job, mark the kept items as building. */
export async function confirmReplay(jobId: string, keep: number[], renames: Record<number, string>): Promise<{ items: number }> {
  const db = supabaseAdmin();
  const { data: job } = await db.from("jobs").select("status").eq("id", jobId).single();
  if (job?.status !== "awaiting_confirm") throw new Error(`job ${jobId} is ${job?.status}, not awaiting confirmation`);
  const { data: all } = await db.from("items").select("id, idx").eq("job_id", jobId);
  const kept = (all ?? []).filter((i) => keep.includes(i.idx));
  if (!kept.length) throw new Error("no items selected");
  const removed = (all ?? []).filter((i) => !keep.includes(i.idx)).map((i) => i.id);
  if (removed.length) await db.from("items").delete().in("id", removed);
  for (const [idx, name] of Object.entries(renames)) {
    const clean = name.trim().slice(0, 60);
    if (clean) await db.from("items").update({ name: clean, user_edited: true }).eq("job_id", jobId).eq("idx", Number(idx));
  }
  await db.from("items").update({ status: "reconstructing" }).in("id", kept.map((i) => i.id));
  await db.from("jobs").update({ status: "reconstructing", timings: { reconstructSubmittedAt: Date.now() } }).eq("id", jobId);
  return { items: kept.length };
}

/** Items finish one by one, with the source job's models, the way fast 3D lands. */
export async function runReplayBuild(jobId: string): Promise<void> {
  const db = supabaseAdmin();
  try {
    const sourceId = await replaySourceOf(jobId);
    if (!sourceId) throw new Error(`job ${jobId} is not a replay`);
    const { data: source } = await db.from("items").select("idx, glb_path").eq("job_id", sourceId);
    const glbOf = new Map((source ?? []).map((i) => [i.idx, i.glb_path]));
    const { data: items } = await db.from("items").select("id, idx").eq("job_id", jobId).eq("status", "reconstructing");
    // a shuffled order reads as parallel work finishing, not a list being ticked off
    const order = [...(items ?? [])].sort((a, b) => ((a.idx * 7919) % 13) - ((b.idx * 7919) % 13));
    await sleep(2400);
    for (const item of order) {
      await db.from("items").update({ status: "ready", glb_path: glbOf.get(item.idx) ?? null }).eq("id", item.id);
      await sleep(450 + ((item.idx * 37) % 5) * 120);
    }
    await db.from("jobs").update({ status: "ready" }).eq("id", jobId);
    log.info("replay build done", { job: jobId, items: order.length });
  } catch (err) {
    log.error("replay build failed", { job: jobId, error: errorMessage(err) });
    await db.from("jobs").update({ status: "failed", error: errorMessage(err).slice(0, 500) }).eq("id", jobId);
  }
}
