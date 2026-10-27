// SAM 3.1 segmentation over the Meta Model API Responses endpoint.
// Docs: https://dev.meta.ai/docs/sam/segmenting · https://dev.meta.ai/docs/sam/reading-segmentation
//
// Two prompt kinds, never mixed in one request:
//   - concept: a short noun phrase, returns every match
//   - boxes:   up to 16 boxes with our own object ids, returns one record per id

import {
  buildObjectPrompt,
  decodeMaskToRaster,
  parseImageStream,
  recordsOfKind,
  type ResponsesEvent,
} from "@meta-sam/parser";
import { cached, hash } from "./cache";
import { createLogger } from "./log";
import { META_MODELS, meta } from "./meta";

const log = createLogger("sam");

export interface PixelBox {
  left: number;
  top: number;
  right: number; // exclusive
  bottom: number; // exclusive
}

/** One segmented object. `raster` is box-local (bounds-sized), row-major 0/1. */
export interface SamMatch {
  objectId: string;
  box: PixelBox;
  confidence: number | null;
  bounds: PixelBox;
  /** raster size in pixels; usually equals the bounds size */
  rasterWidth: number;
  rasterHeight: number;
  raster: Uint8Array;
}

interface CachedMatch extends Omit<SamMatch, "raster"> {
  raster: string; // base64
}

export interface SamImage {
  dataUrl: string;
  width: number;
  height: number;
  /** sha256 of the image bytes, used for cache keys */
  hash: string;
}

export interface SamResult {
  matches: SamMatch[];
  cached: boolean;
  ms: number;
}

async function run(image: SamImage, text: string): Promise<CachedMatch[]> {
  const stream = await meta().responses.create({
    model: META_MODELS.sam,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text },
          { type: "input_image", image_url: image.dataUrl, detail: "auto" },
        ],
      },
    ],
    stream: true,
    metadata: { include_confidence: "true", mask_encoding: "one_bit" },
  });

  const result = await parseImageStream(stream as unknown as AsyncIterable<ResponsesEvent>).finalResult;
  if (result.outcome.status !== "completed") {
    log.warn("stream ended early", { outcome: result.outcome });
  }
  for (const d of result.diagnostics) log.warn("parser diagnostic", { code: d.code, message: d.message });

  const boxes = new Map(recordsOfKind(result.records, "box").map((b) => [b.objectId, b]));
  return recordsOfKind(result.records, "mask").map((m) => {
    const b = boxes.get(m.objectId);
    const box = b ? { left: b.left, top: b.top, right: b.right, bottom: b.bottom } : { ...m.bounds };
    return {
      objectId: m.objectId,
      box,
      confidence: m.confidence ?? b?.confidence ?? null,
      bounds: { ...m.bounds },
      rasterWidth: m.mask.width,
      rasterHeight: m.mask.height,
      raster: Buffer.from(decodeMaskToRaster(m.mask)).toString("base64"),
    };
  });
}

async function segment(image: SamImage, text: string, label: string): Promise<SamResult> {
  const start = performance.now();
  const key = hash(META_MODELS.sam, image.hash, text);
  const { value, hit } = await cached("sam", key, () => run(image, text));
  const ms = Math.round(performance.now() - start);
  log.info("segmented", { prompt: label, matches: value.length, ms, cached: hit });
  return {
    matches: value.map((m) => ({ ...m, raster: new Uint8Array(Buffer.from(m.raster, "base64")) })),
    cached: hit,
    ms,
  };
}

/** Concept prompt: every instance of a short noun phrase. */
export function segmentPhrase(image: SamImage, phrase: string): Promise<SamResult> {
  return segment(image, phrase.trim(), phrase);
}

/** Box prompts: one object per box, reported under the given id. Max 16 per call. */
export function segmentBoxes(image: SamImage, boxes: Array<{ id: number; box: PixelBox }>): Promise<SamResult> {
  if (boxes.length === 0) return Promise.resolve({ matches: [], cached: true, ms: 0 });
  if (boxes.length > 16) throw new Error(`SAM box prompts are limited to 16 objects, got ${boxes.length}`);
  const text = buildObjectPrompt({
    size: { width: image.width, height: image.height },
    objects: boxes.map((b) => ({ id: b.id, prompts: [{ box: b.box }] })),
  });
  return segment(image, text, `${boxes.length} boxes`);
}
