// Copies the local spend ledger (.cache/spend.jsonl) into Supabase api_spend so the budget caps
// count spend made before Supabase was configured. Idempotent: rows already present are skipped.
//   pnpm tsx --conditions=react-server scripts/backfill-spend.ts

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", quiet: true });

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SpendEntry } from "../lib/budget";
import { supabaseAdmin } from "../lib/supabase/server";

async function main() {
  const lines = (await readFile(path.join(process.cwd(), ".cache", "spend.jsonl"), "utf8")).split("\n").filter(Boolean);
  const local = lines.map((l) => JSON.parse(l) as SpendEntry);
  const db = supabaseAdmin();

  const { data: existing, error } = await db.from("api_spend").select("created_at, model, label");
  if (error) throw new Error(error.message);
  const key = (r: { created_at: string; model: string; label?: string | null }) => `${new Date(r.created_at).toISOString()}|${r.model}|${r.label ?? ""}`;
  const seen = new Set((existing ?? []).map(key));

  const missing = local.filter((e) => !seen.has(key(e)));
  if (missing.length) {
    const { error: insertError } = await db.from("api_spend").insert(
      missing.map((e) => ({ provider: e.provider, model: e.model, cost_usd: e.usd, job_id: e.job_id, label: e.label ?? null, created_at: e.created_at })),
    );
    if (insertError) throw new Error(insertError.message);
  }

  const { data: totals } = await db.rpc("spend_by_provider");
  console.log(`local rows ${local.length}, inserted ${missing.length}, already present ${local.length - missing.length}`);
  console.log("api_spend totals", JSON.stringify(totals));
}

main().catch((err) => {
  console.error("backfill failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
