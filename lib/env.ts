// Typed, zod-validated server configuration. Server only: secrets never reach the browser.
// Values come from .env.local locally and from the host's env settings in production.
// Keys are never logged; errors name the variable, never its value.

import { z } from "zod";

if (typeof window !== "undefined") {
  throw new Error("lib/env is server-only and must not be imported from client code");
}

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");
const usd = (fallback: number) => z.coerce.number().nonnegative().default(fallback);
const count = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const Schema = z.object({
  META_API_KEY: z.string().min(1).optional(),
  META_API_BASE_URL: z.url().default("https://api.meta.ai/v1"),
  BASETEN_API_KEY: z.string().min(1).optional(),
  BASETEN_BASE_URL: z.url().default("https://inference.baseten.co/v1"),
  BASETEN_MODEL: z.string().min(1).default("meta-models/muse-spark-open-1026"),
  FAL_KEY: z.string().min(1).optional(),

  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Budget guard (see lib/budget.ts)
  AI_DISABLED: bool,
  MOCK_AI: bool,
  MAX_SPEND_TOTAL_USD: usd(100),
  MAX_SPEND_BASETEN_USD: usd(20),
  MAX_SPEND_FAL_USD: usd(8),
  MAX_SPEND_PER_JOB_USD: usd(1),
  MAX_ITEMS_PER_JOB: count(16),
  MAX_JOBS_PER_DAY: count(40),
  MAX_JOBS_PER_IP_PER_HOUR: count(5),
  ADMIN_TOKEN: z.string().min(16).optional(),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof Schema>;

let parsed: Env | undefined;

export function config(): Env {
  if (!parsed) {
    // empty strings from .env files mean "unset"
    const raw = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]));
    const result = Schema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid environment configuration: ${issues}`);
    }
    parsed = result.data;
  }
  return parsed;
}

type SecretName = "META_API_KEY" | "BASETEN_API_KEY" | "FAL_KEY" | "SUPABASE_SERVICE_ROLE_KEY" | "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

/** Returns a required secret or throws naming the missing variable. */
export function secret(name: SecretName): string {
  const value = config()[name];
  if (!value) throw new Error(`Missing environment variable ${name}. Add it to .env.local.`);
  return value;
}

export function hasSecret(name: SecretName): boolean {
  return Boolean(config()[name]);
}

/** Test hook: forget the parsed config so a changed process.env is re-read. */
export function resetConfig(): void {
  parsed = undefined;
}
