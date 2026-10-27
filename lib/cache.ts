// Content-addressed cache for model calls. Key = sha256 of the call's inputs.
// Stored as files under .cache/ for now; swaps to the model_cache table later.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createLogger } from "./log";

const log = createLogger("cache");
const ROOT = path.join(process.cwd(), ".cache", "models");

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

/**
 * Returns the cached JSON value for key, or runs fn and stores its result.
 * `hit` tells the caller whether money was spent, so cost accounting stays honest.
 */
export async function cached<T>(namespace: string, key: string, fn: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
  const file = path.join(ROOT, namespace, `${key}.json`);
  if (!cacheDisabled()) {
    try {
      const value = JSON.parse(await readFile(file, "utf8")) as T;
      log.debug("hit", { namespace, key: key.slice(0, 12) });
      return { value, hit: true };
    } catch {
      // miss
    }
  }
  const value = await fn();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
  log.debug("stored", { namespace, key: key.slice(0, 12) });
  return { value, hit: false };
}

/** Same as cached() but for binary payloads (e.g. downloaded GLBs). */
export async function cachedBytes(namespace: string, key: string, fn: () => Promise<Buffer>): Promise<{ value: Buffer; hit: boolean }> {
  const file = path.join(ROOT, namespace, key);
  if (!cacheDisabled()) {
    try {
      return { value: await readFile(file), hit: true };
    } catch {
      // miss
    }
  }
  const value = await fn();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, value);
  return { value, hit: false };
}
