// Per-item 3D reconstruction with SAM 3D Objects on fal.
// Two modes: one call carrying every mask (returns individual_glbs[]), or one call per mask.

import { cached, cachedBytes, hash } from "../cache";
import { PRICES } from "../cost";
import { SAM_3D_OBJECTS, falClient, type Sam3dObjectsInput, type Sam3dObjectsOutput } from "../fal";
import { createLogger } from "../log";

const log = createLogger("reconstruct");

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

/** `cacheKeyParts` must identify the image and masks by content, not by their (expiring) URLs. */
export async function reconstruct(
  imageUrl: string,
  maskUrls: string[],
  cacheKeyParts: string[],
  opts: ReconstructOptions,
  label: string,
): Promise<ReconstructCall> {
  const input: Sam3dObjectsInput = {
    image_url: imageUrl,
    mask_urls: maskUrls,
    seed: opts.seed,
    export_textured_glb: opts.textured,
  };
  const key = hash("sam3d-v1", SAM_3D_OBJECTS, String(opts.textured), String(opts.seed), ...cacheKeyParts);
  const start = performance.now();
  const { value, hit } = await cached("sam3d", key, async () => {
    const res = await falClient().subscribe(SAM_3D_OBJECTS, {
      input,
      logs: true,
      pollInterval: 1000,
      onQueueUpdate: (u) => {
        if (u.status === "IN_PROGRESS") for (const l of u.logs ?? []) log.debug("fal", { label, msg: l.message });
      },
    });
    return {
      output: res.data as Sam3dObjectsOutput,
      requestId: res.requestId,
      ms: Math.round(performance.now() - start),
    };
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
  return { ...value, ms, usd: hit ? 0 : PRICES["fal-sam-3d-objects"], cached: hit };
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
