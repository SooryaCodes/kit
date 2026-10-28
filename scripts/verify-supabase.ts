// Verifies the Supabase project end to end, then cleans up:
//   1. service role inserts a job and an item
//   2. anon client reads them back by id (RLS select policy)
//   3. anon client cannot write, and cannot read api_spend
//   4. a Realtime "item updated" event reaches an anon subscriber
//   5. upload to a public and a private bucket; public URL and signed URL both download
//   6. spend_by_provider() works for the service role
//   pnpm verify:supabase

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", quiet: true });

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { secret } from "../lib/env";
import { supabaseAdmin } from "../lib/supabase/server";
import { downloadFile, publicUrl, signedUrl, uploadFile } from "../lib/supabase/storage";

const step = (msg: string) => console.log(`✔ ${msg}`);

async function main() {
  const admin = supabaseAdmin();
  const anon = createClient(secret("NEXT_PUBLIC_SUPABASE_URL"), secret("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false },
  });
  let jobId: string | undefined;
  const files: Array<[string, string]> = [];

  try {
    const { data: job, error: jobErr } = await admin.from("jobs").insert({ template: "bag", status: "uploaded" }).select().single();
    assert.ifError(jobErr);
    jobId = job.id as string;
    const { data: item, error: itemErr } = await admin
      .from("items")
      .insert({ job_id: jobId, idx: 0, name: "verify item", phrase: "test", box: { left: 0, top: 0, right: 1, bottom: 1 } })
      .select()
      .single();
    assert.ifError(itemErr);
    step(`service role inserted job ${jobId} and item`);

    const { data: read, error: readErr } = await anon.from("jobs").select("id, status, items(idx, name, status)").eq("id", jobId).single();
    assert.ifError(readErr);
    assert.equal(read.items.length, 1);
    assert.equal(read.items[0]?.status, "pending");
    step("anon read job + item by id");

    const { error: anonWrite } = await anon.from("jobs").insert({ template: "x" });
    assert.ok(anonWrite, "anon insert into jobs must fail");
    const { data: spendRows, error: spendErr } = await anon.from("api_spend").select("id").limit(1);
    assert.ok(spendErr || (spendRows ?? []).length === 0, "anon must not read api_spend");
    step("anon cannot insert jobs or read api_spend");

    // Realtime: subscribe as anon, then update the item as the server
    const event = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no realtime event within 15s")), 15_000);
      const channel = anon
        .channel(`verify-${jobId}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "items", filter: `job_id=eq.${jobId}` }, (payload) => {
          clearTimeout(timer);
          void anon.removeChannel(channel);
          resolve((payload.new as { status: string }).status);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            // the change listener attaches a moment after SUBSCRIBED, so write a few times until one lands
            for (let i = 0; i < 5; i++) {
              await new Promise((r) => setTimeout(r, 1500));
              const { error } = await admin.from("items").update({ status: i % 2 ? "segmented" : "ready" }).eq("id", item.id);
              if (error) return reject(error);
            }
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(`realtime ${status}`));
        });
    });
    assert.equal(await event, "ready");
    step("realtime item update received by anon subscriber");

    const bytes = Buffer.from("glTF-verify");
    const glbPath = `verify/${jobId}.glb`;
    await uploadFile("glbs", glbPath, bytes, "model/gltf-binary");
    files.push(["glbs", glbPath]);
    const pub = await fetch(publicUrl("glbs", glbPath));
    assert.equal(pub.status, 200);
    assert.equal(Buffer.from(await pub.arrayBuffer()).toString(), "glTF-verify");
    step("public bucket upload + public URL download");

    const maskPath = `verify/${jobId}.png`;
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082", "hex");
    await uploadFile("masks", maskPath, png, "image/png");
    files.push(["masks", maskPath]);
    const signed = await fetch(await signedUrl("masks", maskPath));
    assert.equal(signed.status, 200);
    assert.equal((await downloadFile("masks", maskPath)).length, png.length);
    const { data: anonList } = await anon.storage.from("masks").list("verify");
    assert.equal((anonList ?? []).length, 0, "anon must not list a private bucket");
    step("private bucket upload + signed URL download; anon cannot list");

    const { error: rpcErr } = await admin.rpc("spend_by_provider");
    assert.ifError(rpcErr);
    step("spend_by_provider() callable by service role");

    console.log("\nSupabase verification passed");
  } finally {
    for (const [bucket, path] of files) await admin.storage.from(bucket).remove([path]);
    if (jobId) await admin.from("jobs").delete().eq("id", jobId);
    console.log("cleaned up");
    await anon.removeAllChannels();
  }
}

main().catch((err) => {
  console.error("Supabase verification failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
