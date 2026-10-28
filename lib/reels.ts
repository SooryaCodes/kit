// Reels: an exported MP4 + cover for a job, with the studio settings that made it and a public share slug.
// Videos are uploaded by the browser straight to Storage with one-time signed upload URLs
// (a 10 s 1080x1920 MP4 is ~15 MB, over the 4.5 MB request limit of a serverless function).

import "server-only";
import { randomBytes } from "node:crypto";
import type { Json } from "./database.types";
import { supabaseAdmin } from "./supabase/server";
import { publicUrl } from "./supabase/storage";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function slug(length = 8): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export interface ReelUpload {
  reelId: string;
  slug: string;
  mp4: { path: string; token: string };
  cover: { path: string; token: string };
}

export async function createReel(jobId: string, settings: Json, title: string, preset: string): Promise<ReelUpload> {
  const db = supabaseAdmin();
  const { data: job } = await db.from("jobs").select("id, status").eq("id", jobId).maybeSingle();
  if (!job) throw new Error("job not found");
  if (job.status !== "ready") throw new Error(`job is ${job.status}, not ready`);

  const share = slug();
  const { data: reel, error } = await db.from("reels").insert({ job_id: jobId, settings, title, preset, share_slug: share }).select("id").single();
  if (error || !reel) throw new Error(`could not create reel: ${error?.message}`);

  const mp4Path = `${reel.id}.mp4`;
  const coverPath = `${reel.id}.jpg`;
  const [mp4, cover] = await Promise.all([
    db.storage.from("reels").createSignedUploadUrl(mp4Path),
    db.storage.from("covers").createSignedUploadUrl(coverPath),
  ]);
  if (mp4.error || cover.error) throw new Error(`could not prepare upload: ${mp4.error?.message ?? cover.error?.message}`);
  return { reelId: reel.id, slug: share, mp4: { path: mp4Path, token: mp4.data.token }, cover: { path: coverPath, token: cover.data.token } };
}

/** Marks the reel complete once both files exist in Storage. */
export async function completeReel(reelId: string): Promise<{ slug: string; mp4Url: string; coverUrl: string }> {
  const db = supabaseAdmin();
  const { data: reel } = await db.from("reels").select("id, share_slug").eq("id", reelId).maybeSingle();
  if (!reel?.share_slug) throw new Error("reel not found");
  const [mp4, cover] = await Promise.all([db.storage.from("reels").list("", { search: `${reelId}.mp4` }), db.storage.from("covers").list("", { search: `${reelId}.jpg` })]);
  if (!mp4.data?.length || !cover.data?.length) throw new Error("upload missing");
  await db.from("reels").update({ mp4_path: `${reelId}.mp4`, cover_path: `${reelId}.jpg` }).eq("id", reelId);
  return { slug: reel.share_slug, mp4Url: publicUrl("reels", `${reelId}.mp4`), coverUrl: publicUrl("covers", `${reelId}.jpg`) };
}

export async function getReelBySlug(share: string) {
  const db = supabaseAdmin();
  const { data: reel } = await db.from("reels").select("id, job_id, title, preset, settings, mp4_path, cover_path, created_at").eq("share_slug", share).maybeSingle();
  if (!reel?.mp4_path) return null;
  return {
    ...reel,
    mp4Url: publicUrl("reels", reel.mp4_path),
    coverUrl: reel.cover_path ? publicUrl("covers", reel.cover_path) : null,
  };
}
