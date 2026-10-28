// Storage helpers. Uploads go through the service role; private buckets are read through
// short-lived signed URLs (fal and the Meta API fetch those), public buckets by public URL.

import "server-only";
import { supabaseAdmin } from "./server";

export const BUCKETS = {
  photos: { public: false },
  masks: { public: false },
  crops: { public: false },
  glbs: { public: true },
  reels: { public: true },
  covers: { public: true },
} as const;

export type Bucket = keyof typeof BUCKETS;

const ONE_HOUR = 60 * 60;

export async function uploadFile(bucket: Bucket, path: string, body: Buffer | Blob, contentType: string): Promise<string> {
  const { error } = await supabaseAdmin().storage.from(bucket).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`upload to ${bucket}/${path} failed: ${error.message}`);
  return path;
}

export async function signedUrl(bucket: Bucket, path: string, expiresIn = ONE_HOUR): Promise<string> {
  const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) throw new Error(`signed URL for ${bucket}/${path} failed: ${error?.message}`);
  return data.signedUrl;
}

export function publicUrl(bucket: Bucket, path: string): string {
  if (!BUCKETS[bucket].public) throw new Error(`${bucket} is private; use signedUrl`);
  return supabaseAdmin().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function downloadFile(bucket: Bucket, path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin().storage.from(bucket).download(path);
  if (error || !data) throw new Error(`download ${bucket}/${path} failed: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}
