// Budget guard. Every paid model call (Meta, Baseten, fal) goes through paid().
//
// Before a call: kill switch, mock mode, provider caps, per-job cap.
// During:        at most one retry, only on network errors and 5xx.
// After:         actual cost recorded to the spend ledger and the job, one log line per call.
//
// Ledger: Supabase table api_spend when Supabase is configured, else .cache/spend.jsonl.
// Caps are checked against recorded spend plus in-flight reservations in this process.
// Across serverless instances the check is not atomic, so caps sit well under the real credit.

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { round } from "./cost";
import { config } from "./env";
import { createLogger, errorMessage } from "./log";
import { supabaseAdmin, supabaseConfigured } from "./supabase/server";

const log = createLogger("budget");

export type Provider = "meta" | "baseten" | "fal";

export type BudgetCode =
  | "ai_disabled"
  | "mock_mode"
  | "cap_provider"
  | "cap_job"
  | "cap_items"
  | "cap_jobs_per_day"
  | "cap_ip";

const FRIENDLY: Record<BudgetCode, string> = {
  ai_disabled: "Kit is paused for maintenance. Please try again later.",
  mock_mode: "Running in demo mode: this photo has no saved result yet.",
  cap_provider: "Kit has reached its usage limit for now. Please try again later.",
  cap_job: "This photo needs more processing than one job allows. Try a photo with fewer items.",
  cap_items: "That's a lot of items. Kit handles up to 16 per photo.",
  cap_jobs_per_day: "Kit has hit today's limit. Please come back tomorrow.",
  cap_ip: "You've made a lot of Reels this hour. Please wait a bit and try again.",
};

export class BudgetError extends Error {
  readonly code: BudgetCode;
  readonly userMessage: string;
  constructor(code: BudgetCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "BudgetError";
    this.code = code;
    this.userMessage = FRIENDLY[code];
  }
}

export interface SpendEntry {
  provider: Provider;
  model: string;
  usd: number;
  job_id: string | null;
  label?: string;
  created_at: string;
}

// ── ledger store ────────────────────────────────────────────────────────────

const LEDGER_FILE = path.join(process.cwd(), ".cache", "spend.jsonl");
const JOBS_FILE = path.join(process.cwd(), ".cache", "jobs.jsonl");

async function readJsonl<T>(file: string): Promise<T[]> {
  try {
    const text = await readFile(file, "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as T);
  } catch {
    return [];
  }
}

async function appendJsonl(file: string, row: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, JSON.stringify(row) + "\n");
}

export async function spendByProvider(): Promise<Record<Provider, number>> {
  const totals: Record<Provider, number> = { meta: 0, baseten: 0, fal: 0 };
  if (supabaseConfigured()) {
    const { data, error } = await supabaseAdmin().rpc("spend_by_provider");
    if (!error && Array.isArray(data)) {
      for (const row of data as Array<{ provider: Provider; usd: number }>) totals[row.provider] = Number(row.usd);
      return totals;
    }
    log.error("could not read api_spend, using local ledger", { error: error?.message });
  }
  for (const e of await readJsonl<SpendEntry>(LEDGER_FILE)) totals[e.provider] += e.usd;
  return totals;
}

async function recordSpend(entry: SpendEntry): Promise<void> {
  // the local ledger is always written; it is the source of truth when Supabase is down
  await appendJsonl(LEDGER_FILE, entry);
  if (supabaseConfigured()) {
    const { error } = await supabaseAdmin().from("api_spend").insert(entry);
    if (error) log.error("api_spend insert failed (kept in local ledger)", { error: error.message });
  }
}

async function jobsSince(since: Date): Promise<number> {
  if (supabaseConfigured()) {
    const { count, error } = await supabaseAdmin()
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since.toISOString());
    if (!error && count !== null) return count;
    log.error("could not count jobs, using local ledger", { error: error?.message });
  }
  const rows = await readJsonl<{ created_at: string }>(JOBS_FILE);
  return rows.filter((r) => new Date(r.created_at) >= since).length;
}

// ── caps ────────────────────────────────────────────────────────────────────

function providerCap(p: Provider): number {
  const c = config();
  return p === "meta" ? c.MAX_SPEND_TOTAL_USD : p === "baseten" ? c.MAX_SPEND_BASETEN_USD : c.MAX_SPEND_FAL_USD;
}

const reserved: Record<Provider, number> = { meta: 0, baseten: 0, fal: 0 };

export function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Per-job spend tracker. Create one with startJob() before any paid call for that job. */
export class JobBudget {
  spent = 0;
  private inFlight = 0;
  readonly lines: Array<{ provider: Provider; model: string; usd: number; label?: string }> = [];
  constructor(readonly jobId: string) {}

  /** Throws cap_items when a job would reconstruct more items than allowed. */
  assertItems(n: number): void {
    const max = config().MAX_ITEMS_PER_JOB;
    if (n > max) throw new BudgetError("cap_items", `${n} items > MAX_ITEMS_PER_JOB ${max}`);
  }

  reserve(usd: number): void {
    const cap = config().MAX_SPEND_PER_JOB_USD;
    if (this.spent + this.inFlight + usd > cap + 1e-9) {
      throw new BudgetError("cap_job", `job ${this.jobId} at $${round(this.spent + this.inFlight)}, call est $${usd}, cap $${cap}`);
    }
    this.inFlight += usd;
  }

  settle(estimate: number, actual: number, line: JobBudget["lines"][number]): void {
    this.inFlight = Math.max(0, this.inFlight - estimate);
    this.spent = round(this.spent + actual);
    this.lines.push(line);
  }

  release(estimate: number): void {
    this.inFlight = Math.max(0, this.inFlight - estimate);
  }

  byProvider(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const l of this.lines) out[`${l.provider}:${l.model}`] = round((out[`${l.provider}:${l.model}`] ?? 0) + l.usd);
    return out;
  }
}

/**
 * Checks the kill switch and the daily job cap, records the job start, and returns its budget.
 * Pass recordStart=false when the jobs table row is inserted by the caller (then it counts itself).
 */
export async function startJob(jobId: string, opts: { recordStart?: boolean } = {}): Promise<JobBudget> {
  const c = config();
  if (c.AI_DISABLED) throw new BudgetError("ai_disabled", "AI_DISABLED is set");
  const today = await jobsSince(startOfUtcDay());
  if (today >= c.MAX_JOBS_PER_DAY) throw new BudgetError("cap_jobs_per_day", `${today} jobs today, cap ${c.MAX_JOBS_PER_DAY}`);
  if (opts.recordStart !== false) await appendJsonl(JOBS_FILE, { job_id: jobId, created_at: new Date().toISOString() });
  return new JobBudget(jobId);
}

// ── paid call wrapper ───────────────────────────────────────────────────────

export interface PaidCall<T> {
  provider: Provider;
  model: string;
  /** upper-bound estimate in USD, used for the cap check before the call */
  estimateUsd: number;
  /** actual cost from the response (token usage etc.); defaults to the estimate */
  actualUsd?: (result: T) => number;
  job?: JobBudget;
  label?: string;
}

function retryable(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  if (typeof status === "number") return status >= 500;
  // no HTTP status: connection reset, DNS, timeout
  const name = (err as { name?: string }).name ?? "";
  return /connection|timeout|fetch|network|abort/i.test(name + " " + errorMessage(err));
}

export async function paid<T>(call: PaidCall<T>, fn: () => Promise<T>): Promise<T> {
  const c = config();
  if (c.AI_DISABLED) throw new BudgetError("ai_disabled", `${call.provider}/${call.model} blocked by AI_DISABLED`);
  if (c.MOCK_AI) throw new BudgetError("mock_mode", `${call.provider}/${call.model} has no cached response (MOCK_AI on)`);
  if (call.model.endsWith("-contributor")) throw new Error(`Contributor-tier model ${call.model} is not allowed`);

  const totals = await spendByProvider();
  const cap = providerCap(call.provider);
  const projected = totals[call.provider] + reserved[call.provider] + call.estimateUsd;
  if (projected > cap + 1e-9) {
    throw new BudgetError("cap_provider", `${call.provider} at $${round(totals[call.provider])} (+$${round(reserved[call.provider])} in flight), call est $${call.estimateUsd}, cap $${cap}`);
  }
  call.job?.reserve(call.estimateUsd);
  reserved[call.provider] += call.estimateUsd;

  let result: T;
  try {
    try {
      result = await fn();
    } catch (err) {
      if (!retryable(err)) throw err;
      log.warn("retrying once", { provider: call.provider, model: call.model, label: call.label, error: errorMessage(err) });
      result = await fn();
    }
  } catch (err) {
    reserved[call.provider] -= call.estimateUsd;
    call.job?.release(call.estimateUsd);
    throw err;
  }

  reserved[call.provider] -= call.estimateUsd;
  const actual = round(call.actualUsd ? call.actualUsd(result) : call.estimateUsd);
  call.job?.settle(call.estimateUsd, actual, { provider: call.provider, model: call.model, usd: actual, label: call.label });
  await recordSpend({
    provider: call.provider,
    model: call.model,
    usd: actual,
    job_id: call.job?.jobId ?? null,
    label: call.label,
    created_at: new Date().toISOString(),
  });
  log.info("paid call", {
    provider: call.provider,
    model: call.model,
    label: call.label,
    estUsd: call.estimateUsd,
    usd: actual,
    providerTotal: round(totals[call.provider] + actual),
    cap,
    job: call.job?.jobId,
    jobTotal: call.job?.spent,
  });
  return result;
}

export async function spendSummary() {
  const c = config();
  const totals = await spendByProvider();
  return {
    totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, round(v)])),
    caps: { meta: c.MAX_SPEND_TOTAL_USD, baseten: c.MAX_SPEND_BASETEN_USD, fal: c.MAX_SPEND_FAL_USD, perJob: c.MAX_SPEND_PER_JOB_USD },
    limits: { itemsPerJob: c.MAX_ITEMS_PER_JOB, jobsPerDay: c.MAX_JOBS_PER_DAY, jobsPerIpPerHour: c.MAX_JOBS_PER_IP_PER_HOUR },
    jobsToday: await jobsSince(startOfUtcDay()),
    aiDisabled: c.AI_DISABLED,
    mockAi: c.MOCK_AI,
    ledger: supabaseConfigured() ? "supabase" : "local",
  };
}
