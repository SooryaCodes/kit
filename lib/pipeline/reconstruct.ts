// Per-item 3D reconstruction with SAM 3D Objects on fal.
// Two modes: one call carrying every mask (returns individual_glbs[]), or one call per mask.
//
// Only the queue submit is billable and goes through the budget guard (with its single
// network/5xx retry). Polling and fetching the result are free and never re-submit.
// A pending marker keyed by input hash stores the request id, so a re-run resumes the
// existing request instead of paying for it twice.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { paid, type JobBudget } from "../budget";
import { cached, cachedBytes, hash } from "../cache";
import { PRICES } from "../cost";
import { SAM_3D_OBJECTS, falClient, type Sam3dObjectsInput, type Sam3dObjectsOutput } from "../fal";
import { createLogger } from "../log";

const log = createLogger("reconstruct");
const PENDING_DIR = path.join(process.cwd(), ".cache", "models", "sam3d-pending");

export interface ReconstructOptions {
  textured: boolean;
  seed: number;
}

export interface ReconstructCall {
  output: Sam3dObjectsOutput;
  requestId: string;
  ms: number;
  usd: number;
  cached: boolean;
}

async function readPending(key: string): Promise<string | undefined> {
  try {
    return (JSON.parse(await readFile(path.join(PENDING_DIR, `${key}.json`), "utf8")) as { requestId: string }).requestId;
  } catch {
    return undefined;
  }
}

async function writePending(key: string, requestId: string): Promise<void> {
  await mkdir(PENDING_DIR, { recursive: true });
  await writeFile(path.join(PENDING_DIR, `${key}.json`), JSON.stringify({ requestId, at: new Date().toISOString() }));
}

/** `cacheKeyParts` must identify the image and masks by content, not by their (expiring) URLs. */
export async function reconstruct(
  imageUrl: string,
  maskUrls: string[],
  cacheKeyParts: string[],
  opts: ReconstructOptions,
  label: string,
  job?: JobBudget,
): Promise<ReconstructCall> {
  const input: Sam3dObjectsInput = {
    image_url: imageUrl,
    mask_urls: maskUrls,
    seed: opts.seed,
    export_textured_glb: opts.textured,
  };
  const key = hash("sam3d-v1", SAM_3D_OBJECTS, String(opts.textured), String(opts.seed), ...cacheKeyParts);
  const start = performance.now();
  let charged = 0;

  const { value, hit } = await cached("sam3d", key, async () => {
    const fal = falClient();
    let requestId = await readPending(key);
    if (requestId) {
      log.warn("resuming existing fal request instead of re-submitting", { label, requestId });
    } else {
      const submitted = await paid(
        { provider: "fal", model: SAM_3D_OBJECTS, estimateUsd: PRICES["fal-sam-3d-objects"], job, label: `sam3d ${label}` },
        () => fal.queue.submit(SAM_3D_OBJECTS, { input }),
      );
      charged = PRICES["fal-sam-3d-objects"];
      requestId = submitted.request_id;
      await writePending(key, requestId);
    }
    await fal.queue.subscribeToStatus(SAM_3D_OBJECTS, {
      requestId,
      logs: true,
      pollInterval: 1000,
      onQueueUpdate: (u) => {
        if (u.status === "IN_PROGRESS") for (const l of u.logs ?? []) log.debug("fal", { label, msg: l.message });
      },
    });
    const res = await fal.queue.result(SAM_3D_OBJECTS, { requestId });
    await rm(path.join(PENDING_DIR, `${key}.json`), { force: true });
    return { output: res.data as Sam3dObjectsOutput, requestId, ms: Math.round(performance.now() - start) };
  });

  const ms = hit ? value.ms : Math.round(performance.now() - start);
  log.info("reconstructed", {
    label,
    masks: maskUrls.length,
    individual: value.output.individual_glbs?.length ?? 0,
    combined: Boolean(value.output.model_glb),
    ms,
    cached: hit,
  });
  return { ...value, ms, usd: hit ? 0 : charged, cached: hit };
}

/** fal returns a combined scene GLB plus per-object GLBs only when there are several objects. */
export function glbUrls(out: Sam3dObjectsOutput): string[] {
  if (out.individual_glbs?.length) return out.individual_glbs.map((f) => f.url);
  return out.model_glb ? [out.model_glb.url] : [];
}

export async function downloadGlb(url: string): Promise<Buffer> {
  const { value } = await cachedBytes("glb", hash(url) + ".glb", async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GLB download failed ${res.status} for ${url}`);
    return Buffer.from(await res.arrayBuffer());
  });
  return value;
}
