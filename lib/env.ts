// Typed access to environment variables. Throws a clear error the first time a
// missing variable is read, instead of failing deep inside an SDK call.

const DEFAULTS: Record<string, string> = {
  META_API_BASE_URL: "https://api.meta.ai/v1",
  BASETEN_BASE_URL: "https://inference.baseten.co/v1",
  BASETEN_MODEL: "meta-models/muse-spark-open-1026",
  LOG_LEVEL: "info",
};

export function env(name: string): string {
  const value = process.env[name] || DEFAULTS[name];
  if (!value) throw new Error(`Missing environment variable ${name}. Add it to .env.local.`);
  return value;
}

export function hasEnv(name: string): boolean {
  return Boolean(process.env[name] || DEFAULTS[name]);
}
