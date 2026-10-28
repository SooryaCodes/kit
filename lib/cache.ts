// Content-addressed cache for model calls. Key = sha256 of the call's inputs.
//   file: JSON files under CACHE_ROOT (.cache locally, /tmp on serverless where the app folder is read-only)
//   db:   Supabase model_cache, shared by every server instance (for small, valuable results)
// Writes are best-effort: a cache that can't be written must never fail a call that already succeeded.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Json } from "./database.types";
import { createLogger, errorMessage } from "./log";
import { supabaseAdmin, supabaseConfigured } from "./supabase/server";

const log = createLogger("cache");

export const CACHE_ROOT = process.env.VERCEL ? "/tmp/kit-cache" : path.join(process.cwd(), ".cache");
const MODELS = path.join(CACHE_ROOT, "models");

export function hash(...parts: Array<string | Buffer | Uint8Array>): string {
  const h = createHash("sha256");
  for (const part of parts) {
    h.update(part);
    h.update("\0");
  }
  return h.digest("hex");
}

export function cacheDisabled(): boolean {
  return process.env.KIT_NO_CACHE === "1";
}

async function readDb<T>(key: string): Promise<T | undefined> {
  const { data } = await supabaseAdmin().from("model_cache").select("response").eq("key", key).maybeSingle();
  return data ? (data.response as T) : undefined;
}

async function writeDb(namespace: string, key: string, value: unknown): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("model_cache")
    .upsert({ key, provider: "kit", model: namespace, response: value as Json });
  if (error) throw new Error(error.message);
}

/**
 * Returns the cached JSON value for key, or runs fn and stores its result.
 * `hit` tells the caller whether money was spent, so cost accounting stays honest.
 */
export async function cached<T>(
  namespace: string,
  key: string,
  fn: () => Promise<T>,
  opts: { store?: "file" | "db" } = {},
): Promise<{ value: T; hit: boolean }> {
  const useDb = opts.store === "db" && supabaseConfigured();
  const dbKey = `${namespace}:${key}`;
  const file = path.join(MODELS, namespace, `${key}.json`);

  if (!cacheDisabled()) {
    try {
      const value = useDb ? await readDb<T>(dbKey) : (JSON.parse(await readFile(file, "utf8")) as T);
      if (value !== undefined) {
        log.debug("hit", { namespace, key: key.slice(0, 12), store: useDb ? "db" : "file" });
        return { value, hit: true };
      }
    } catch {
      // miss
    }
  }

  const value = await fn();
  try {
    if (useDb) await writeDb(namespace, dbKey, value);
    else {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(value));
    }
    log.debug("stored", { namespace, key: key.slice(0, 12), store: useDb ? "db" : "file" });
  } catch (err) {
    log.warn("cache write failed", { namespace, error: errorMessage(err) });
  }
  return { value, hit: false };
}

/** Same as cached() but for binary payloads (e.g. downloaded GLBs), always on the file store. */
export async function cachedBytes(namespace: string, key: string, fn: () => Promise<Buffer>): Promise<{ value: Buffer; hit: boolean }> {
  const file = path.join(MODELS, namespace, key);
  if (!cacheDisabled()) {
    try {
      return { value: await readFile(file), hit: true };
    } catch {
      // miss
    }
  }
  const value = await fn();
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, value);
  } catch (err) {
    log.warn("cache write failed", { namespace, error: errorMessage(err) });
  }
  return { value, hit: false };
}
