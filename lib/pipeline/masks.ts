// Turn SAM matches into one clean mask per item: assign matches to listed items,
// fall back to box prompts for misses, dedupe overlaps, write mask PNGs and cutouts.

import sharp from "sharp";
import type { PixelBox, SamMatch } from "../sam";

export interface ItemMask {
  /** stable index within the photo, used for file names */
  index: number;
  name: string;
  phrase: string;
  category: string;
  flat: boolean;
  partial: boolean;
  source: "phrase" | "box" | "extra";
  confidence: number | null;
  box: PixelBox;
  match: SamMatch;
  area: number;
}

export function boxArea(b: PixelBox): number {
  return Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
}

export function boxIoU(a: PixelBox, b: PixelBox): number {
  const inter = boxArea({
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  });
  const union = boxArea(a) + boxArea(b) - inter;
  return union > 0 ? inter / union : 0;
}

/** Is source pixel (x, y) inside the mask? Maps through the raster scale. */
function covers(m: SamMatch, x: number, y: number): boolean {
  const { left, top, right, bottom } = m.bounds;
  if (x < left || x >= right || y < top || y >= bottom) return false;
  const rx = Math.min(m.rasterWidth - 1, Math.floor(((x - left) * m.rasterWidth) / (right - left)));
  const ry = Math.min(m.rasterHeight - 1, Math.floor(((y - top) * m.rasterHeight) / (bottom - top)));
  return m.raster[ry * m.rasterWidth + rx] === 1;
}

export function maskArea(m: SamMatch): number {
  let n = 0;
  for (let i = 0; i < m.raster.length; i++) n += m.raster[i] ?? 0;
  // scale raster pixels back to source pixels when the raster is downsampled
  return Math.round((n * boxArea(m.bounds)) / Math.max(1, m.rasterWidth * m.rasterHeight));
}

export function maskIoU(a: SamMatch, b: SamMatch): number {
  const left = Math.max(a.bounds.left, b.bounds.left);
  const top = Math.max(a.bounds.top, b.bounds.top);
  const right = Math.min(a.bounds.right, b.bounds.right);
  const bottom = Math.min(a.bounds.bottom, b.bounds.bottom);
  if (right <= left || bottom <= top) return 0;
  let inter = 0;
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) if (covers(a, x, y) && covers(b, x, y)) inter++;
  const union = maskArea(a) + maskArea(b) - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Greedy one-to-one assignment of SAM matches to listed items by box IoU.
 * Returns pairs plus the leftovers on each side.
 */
export function assignMatches<T extends { pixelBox: PixelBox }>(
  items: T[],
  matches: SamMatch[],
  minIoU = 0.1,
): { pairs: Array<{ item: T; match: SamMatch; iou: number }>; unmatchedItems: T[]; unmatchedMatches: SamMatch[] } {
  const scored: Array<{ i: number; m: number; iou: number }> = [];
  items.forEach((it, i) => matches.forEach((mt, m) => scored.push({ i, m, iou: boxIoU(it.pixelBox, mt.box) })));
  scored.sort((a, b) => b.iou - a.iou);
  const usedI = new Set<number>();
  const usedM = new Set<number>();
  const pairs: Array<{ item: T; match: SamMatch; iou: number }> = [];
  for (const s of scored) {
    if (s.iou < minIoU || usedI.has(s.i) || usedM.has(s.m)) continue;
    usedI.add(s.i);
    usedM.add(s.m);
    pairs.push({ item: items[s.i]!, match: matches[s.m]!, iou: s.iou });
  }
  return {
    pairs,
    unmatchedItems: items.filter((_, i) => !usedI.has(i)),
    unmatchedMatches: matches.filter((_, m) => !usedM.has(m)),
  };
}

/** Drops masks that overlap a higher-confidence mask by more than `maxIoU`. */
export function dedupe(masks: ItemMask[], maxIoU = 0.6): { kept: ItemMask[]; dropped: Array<{ mask: ItemMask; overlapsWith: string; iou: number }> } {
  const rank = (m: ItemMask) => (m.source === "phrase" ? 1 : 0) + (m.confidence ?? 0.5);
  const sorted = [...masks].sort((a, b) => rank(b) - rank(a));
  const kept: ItemMask[] = [];
  const dropped: Array<{ mask: ItemMask; overlapsWith: string; iou: number }> = [];
  for (const m of sorted) {
    let worst: { other: ItemMask; iou: number } | undefined;
    for (const k of kept) {
      if (boxIoU(m.box, k.box) < 0.3) continue; // cheap reject before pixel IoU
      const iou = maskIoU(m.match, k.match);
      if (iou > maxIoU && (!worst || iou > worst.iou)) worst = { other: k, iou };
    }
    if (worst) dropped.push({ mask: m, overlapsWith: worst.other.name, iou: Math.round(worst.iou * 100) / 100 });
    else kept.push(m);
  }
  return { kept: kept.sort((a, b) => a.index - b.index), dropped };
}

/** Full-frame binary mask PNG: white = object, black = background (fal's expected format). */
export async function maskPng(m: SamMatch, width: number, height: number): Promise<Buffer> {
  const px = Buffer.alloc(width * height);
  const { left, top, right, bottom } = m.bounds;
  for (let y = Math.max(0, top); y < Math.min(height, bottom); y++) {
    for (let x = Math.max(0, left); x < Math.min(width, right); x++) {
      if (covers(m, x, y)) px[y * width + x] = 255;
    }
  }
  return sharp(px, { raw: { width, height, channels: 1 } }).png().toBuffer();
}

/** Transparent-background cutout of the item, padded around its mask bounds. */
export async function cropPng(photo: Buffer, m: SamMatch, width: number, height: number, pad = 0.06): Promise<Buffer> {
  const bw = m.bounds.right - m.bounds.left;
  const bh = m.bounds.bottom - m.bounds.top;
  const p = Math.round(Math.max(bw, bh) * pad);
  const left = Math.max(0, m.bounds.left - p);
  const top = Math.max(0, m.bounds.top - p);
  const right = Math.min(width, m.bounds.right + p);
  const bottom = Math.min(height, m.bounds.bottom + p);
  const w = right - left;
  const h = bottom - top;
  const rgba = await sharp(photo).extract({ left, top, width: w, height: h }).ensureAlpha().raw().toBuffer();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rgba[(y * w + x) * 4 + 3] = covers(m, left + x, top + y) ? 255 : 0;
  return sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}
