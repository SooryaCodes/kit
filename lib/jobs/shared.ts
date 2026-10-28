// Helpers shared by the job stages: storage paths, cost and timing persistence, failure handling.

import "server-only";
import { BudgetError, type JobBudget } from "../budget";
import { round } from "../cost";
import { errorMessage } from "../log";
import type { Json } from "../database.types";
import { supabaseAdmin } from "../supabase/server";

export const paths = {
  photo: (job: string) => `${job}/photo.jpg`,
  mask: (job: string, idx: number) => `${job}/${idx}.png`,
  crop: (job: string, idx: number) => `${job}/${idx}.png`,
  glb: (job: string, idx: number) => `${job}/${idx}.glb`,
};

type CostDoc = { totalUsd?: number; byModel?: Record<string, number> } & Record<string, unknown>;

export function jobCostTotal(cost: Json | null | undefined): number {
  const doc = (cost ?? {}) as CostDoc;
  return typeof doc.totalUsd === "number" ? doc.totalUsd : 0;
}

/**
 * Merges this request's spend into jobs.cost and its timings into jobs.timings.
 * Read-modify-write: stages of one job run one after another, never at the same time.
 */
export async function recordJobCost(
  jobId: string,
  job: JobBudget,
  opts: { timings?: Record<string, number>; extra?: Record<string, unknown> } = {},
): Promise<void> {
  const db = supabaseAdmin();
  const { data } = await db.from("jobs").select("cost, timings").eq("id", jobId).single();
  const cost = (data?.cost ?? {}) as CostDoc;
  const byModel = { ...(cost.byModel ?? {}) };
  for (const [k, v] of Object.entries(job.byProvider())) byModel[k] = round((byModel[k] ?? 0) + v);
  const timings = { ...((data?.timings ?? {}) as Record<string, number>), ...(opts.timings ?? {}) };
  await db
    .from("jobs")
    .update({ cost: { ...cost, ...(opts.extra ?? {}), byModel, totalUsd: job.spent } as Json, timings: timings as Json })
    .eq("id", jobId);
  job.lines.length = 0; // lines are now persisted; a later call in the same request adds only new ones
}

export async function failJob(jobId: string, err: unknown, job?: JobBudget): Promise<void> {
  const db = supabaseAdmin();
  if (job) await recordJobCost(jobId, job).catch(() => undefined);
  const budget = err instanceof BudgetError;
  await db
    .from("jobs")
    .update({
      status: budget ? "budget_exceeded" : "failed",
      error: errorMessage(err).slice(0, 500),
      user_message: budget ? err.userMessage : "Something went wrong while building this Reel. Please try again.",
    })
    .eq("id", jobId);
}
