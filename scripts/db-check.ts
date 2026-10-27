// Verifies the Supabase project after migrations: insert + read a job and item,
// check spend_by_provider(), upload + read a file in a public bucket, then clean up.
//   pnpm tsx scripts/db-check.ts

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", quiet: true });

import assert from "node:assert/strict";
import { supabaseAdmin } from "../lib/supabase/server";

async function main() {
  const db = supabaseAdmin();

  const { data: job, error: jobErr } = await db.from("jobs").insert({ template: "bag", status: "uploaded" }).select().single();
  assert.ifError(jobErr);
  console.log("job inserted", job.id);

  const { error: itemErr } = await db.from("items").insert({ job_id: job.id, idx: 0, name: "test item", phrase: "test", box: { left: 0, top: 0, right: 1, bottom: 1 } });
  assert.ifError(itemErr);

  const { data: read, error: readErr } = await db.from("jobs").select("id, status, items(idx, name, status)").eq("id", job.id).single();
  assert.ifError(readErr);
  assert.equal(read.items.length, 1);
  assert.equal(read.items[0]?.status, "pending");
  console.log("job + item read back", JSON.stringify(read));

  const { error: rpcErr } = await db.rpc("spend_by_provider");
  assert.ifError(rpcErr);
  console.log("spend_by_provider ok");

  const { data: buckets, error: bErr } = await db.storage.listBuckets();
  assert.ifError(bErr);
  console.log("buckets", buckets.map((b) => `${b.id}${b.public ? " (public)" : ""}`).join(", "));

  const path = `checks/${job.id}.png`;
  const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082", "hex");
  const { error: upErr } = await db.storage.from("glbs").upload(path, png, { contentType: "image/png" });
  assert.ifError(upErr);
  const url = db.storage.from("glbs").getPublicUrl(path).data.publicUrl;
  const res = await fetch(url);
  assert.equal(res.status, 200);
  console.log("public bucket upload + read ok");

  await db.storage.from("glbs").remove([path]);
  await db.from("jobs").delete().eq("id", job.id);
  console.log("cleaned up. Supabase check passed");
}

main().catch((err) => {
  console.error("Supabase check failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
