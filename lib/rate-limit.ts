// Per-IP limit on job creation, so strangers can't spend credits after deploy.
// IPs are stored only as salted hashes in job_requests (service role only).

import { createHash } from "node:crypto";
import { BudgetError } from "./budget";
import { config } from "./env";
import { supabaseAdmin, supabaseConfigured } from "./supabase/server";

const memory = new Map<string, number[]>(); // dev fallback when Supabase is not configured

export function hashIp(ip: string): string {
  return createHash("sha256").update(`kit-rate:${ip}`).digest("hex").slice(0, 32);
}

/** Reads the client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

/** Throws BudgetError("cap_ip") when this IP already started too many jobs in the last hour. */
export async function checkJobRateLimit(ip: string, jobId?: string): Promise<void> {
  const cap = config().MAX_JOBS_PER_IP_PER_HOUR;
  const ipHash = hashIp(ip);
  const since = Date.now() - 60 * 60 * 1000;

  if (!supabaseConfigured()) {
    const recent = (memory.get(ipHash) ?? []).filter((t) => t > since);
    if (recent.length >= cap) throw new BudgetError("cap_ip", `${recent.length} jobs in the last hour, cap ${cap}`);
    memory.set(ipHash, [...recent, Date.now()]);
    return;
  }

  const db = supabaseAdmin();
  const { count, error } = await db
    .from("job_requests")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", new Date(since).toISOString());
  if (error) throw new Error(`rate limit check failed: ${error.message}`);
  if ((count ?? 0) >= cap) throw new BudgetError("cap_ip", `${count} jobs in the last hour, cap ${cap}`);
  const { error: insertError } = await db.from("job_requests").insert({ ip_hash: ipHash, job_id: jobId ?? null });
  if (insertError) throw new Error(`rate limit record failed: ${insertError.message}`);
}
