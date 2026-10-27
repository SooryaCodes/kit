// Exercises lib/budget.ts with fake calls: no network, no spend.
// Uses a throwaway ledger directory so real spend records are untouched.
//   pnpm tsx scripts/budget-selftest.ts

import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function main() {
  process.chdir(await mkdtemp(path.join(os.tmpdir(), "kit-budget-")));
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "AI_DISABLED", "MOCK_AI"]) delete process.env[k];
  Object.assign(process.env, { MAX_SPEND_FAL_USD: "0.05", MAX_SPEND_PER_JOB_USD: "0.03", MAX_JOBS_PER_DAY: "2", MAX_ITEMS_PER_JOB: "16", LOG_LEVEL: "warn" });

  const { resetConfig } = await import("../lib/env");
  const { BudgetError, paid, spendByProvider, startJob } = await import("../lib/budget");
  const code = async (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof BudgetError ? e.code : `other: ${(e as Error).message}`));

  let calls = 0;
  const fake = (status?: number) => async () => {
    calls++;
    if (status) throw Object.assign(new Error(`HTTP ${status}`), { status });
    return { ok: true };
  };
  const fal = (job?: Awaited<ReturnType<typeof startJob>>) => ({ provider: "fal" as const, model: "fal-ai/sam-3/3d-objects", estimateUsd: 0.02, job });

  // per-job cap: $0.03 allows one $0.02 call, refuses the second
  const job = await startJob("job-1");
  assert.equal(await code(paid(fal(job), fake())), "ok");
  assert.equal(await code(paid(fal(job), fake())), "cap_job");

  // provider cap: $0.05 total; 0.02 spent, one more fits, the next is refused
  assert.equal(await code(paid(fal(), fake())), "ok");
  assert.equal(await code(paid(fal(), fake())), "cap_provider");
  assert.equal((await spendByProvider()).fal, 0.04);

  // retries: a 4xx is never retried, a 5xx is retried exactly once
  process.env.MAX_SPEND_FAL_USD = "1";
  resetConfig();
  calls = 0;
  assert.match(await code(paid(fal(), fake(400))), /other: HTTP 400/);
  assert.equal(calls, 1);
  calls = 0;
  assert.match(await code(paid(fal(), fake(503))), /other: HTTP 503/);
  assert.equal(calls, 2);

  // item cap
  assert.throws(() => job.assertItems(17), (e: unknown) => e instanceof BudgetError && e.code === "cap_items");

  // daily job cap: 2 per day, one already started
  await startJob("job-2");
  assert.equal(await code(startJob("job-3")), "cap_jobs_per_day");

  // contributor tier is refused outright
  assert.match(await code(paid({ provider: "meta", model: "muse-spark-1.3-contributor", estimateUsd: 0.001 }, fake())), /Contributor-tier/);

  // kill switch and mock mode block before the call runs
  calls = 0;
  process.env.AI_DISABLED = "true";
  resetConfig();
  assert.equal(await code(paid(fal(), fake())), "ai_disabled");
  process.env.AI_DISABLED = "false";
  process.env.MOCK_AI = "true";
  resetConfig();
  assert.equal(await code(paid(fal(), fake())), "mock_mode");
  assert.equal(calls, 0);

  console.log("budget self-test passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
