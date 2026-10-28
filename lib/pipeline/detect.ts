// Detect step: list the photo's items, segment each with SAM 3.1, and return one clean mask per item.
//   1. Muse Spark lists items (name, phrase, box)
//   2. one SAM call per distinct phrase, matches assigned to items by box IoU
//   3. items the phrase missed are retried with box prompts
//   4. drop specks, edge slivers and duplicates, keep the largest `maxItems`

import pLimit from "p-limit";
import { BudgetError, type JobBudget } from "../budget";
import { createLogger, errorMessage } from "../log";
import { segmentBoxes, segmentPhrase, type SamMatch } from "../sam";
import { listItems, type ListResult } from "./list-items";
import { assignMatches, dedupe, maskArea, type ItemMask } from "./masks";
import type { Photo } from "./photo";

const log = createLogger("detect");

/** masks smaller than this share of the photo are noise */
const MIN_AREA_FRACTION = 0.001;

export interface DetectResult {
  items: ItemMask[];
  dropped: Array<{ name: string; reason: string }>;
  notes: string[];
  lister: { model: string; listed: number; usd: number; cached: boolean };
  timings: { listMs: number; segmentMs: number };
  samCalls: number;
}

type Listed = ListResult["items"][number];

function toMask(index: number, it: Listed, match: SamMatch, source: ItemMask["source"]): ItemMask {
  return {
    index,
    name: it.name,
    phrase: it.phrase,
    category: it.category,
    flat: it.flat,
    partial: it.partial,
    source,
    confidence: match.confidence,
    box: match.box,
    match,
    area: maskArea(match),
  };
}

export async function detectItems(photo: Photo, job: JobBudget, maxItems: number): Promise<DetectResult> {
  const notes: string[] = [];
  const dropped: DetectResult["dropped"] = [];

  const t0 = performance.now();
  const list = await listItems(photo, job);
  const listMs = Math.round(performance.now() - t0);

  const t1 = performance.now();
  const minArea = photo.width * photo.height * MIN_AREA_FRACTION;
  const groups = new Map<string, Listed[]>();
  for (const it of list.items) {
    const key = it.phrase.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }

  const limit = pLimit(6);
  const results = await Promise.all(
    [...groups.entries()].map(([phrase, items]) =>
      limit(async () => {
        try {
          return { items, res: await segmentPhrase(photo, phrase, job) };
        } catch (err) {
          if (err instanceof BudgetError) throw err;
          log.warn("phrase failed", { phrase, error: errorMessage(err) });
          return { items, res: undefined };
        }
      }),
    ),
  );

  let samCalls = results.length;
  let index = 0;
  const masks: ItemMask[] = [];
  const misses: Listed[] = [];
  for (const { items, res } of results) {
    if (!res) {
      misses.push(...items);
      continue;
    }
    const { pairs, unmatchedItems, unmatchedMatches } = assignMatches(items, res.matches);
    for (const { item, match } of pairs) masks.push(toMask(index++, item, match, "phrase"));
    misses.push(...unmatchedItems);
    // SAM found more of this thing than the lister named: keep the confident, non-trivial ones
    for (const m of unmatchedMatches) {
      if ((m.confidence ?? 0) >= 0.6 && maskArea(m) >= minArea) masks.push(toMask(index++, { ...items[0]!, partial: false }, m, "extra"));
    }
  }

  for (let i = 0; i < misses.length; i += 16) {
    const chunk = misses.slice(i, i + 16);
    try {
      const res = await segmentBoxes(photo, chunk.map((it, j) => ({ id: j + 1, box: it.pixelBox })), job);
      samCalls++;
      for (const m of res.matches) {
        const it = chunk[Number(m.objectId) - 1];
        if (it) masks.push(toMask(index++, it, m, "box"));
      }
    } catch (err) {
      if (err instanceof BudgetError) throw err;
      notes.push(`box prompt fallback failed: ${errorMessage(err)}`);
    }
  }
  if (misses.length) notes.push(`${misses.length} item(s) found by box prompt instead of phrase`);

  const whole = masks.filter((m) => {
    if (m.area < minArea) {
      dropped.push({ name: m.name, reason: "too small" });
      return false;
    }
    const b = m.match.bounds;
    const touchesEdge = b.left <= 1 || b.top <= 1 || b.right >= photo.width - 1 || b.bottom >= photo.height - 1;
    if (m.partial && touchesEdge) {
      dropped.push({ name: m.name, reason: "cut off by the photo edge" });
      return false;
    }
    return true;
  });

  const { kept, dropped: dupes } = dedupe(whole);
  for (const d of dupes) dropped.push({ name: d.mask.name, reason: `duplicate of ${d.overlapsWith}` });

  // over the cap: keep the largest items, they read best in 3D
  const bySize = [...kept].sort((a, b) => b.area - a.area);
  for (const m of bySize.slice(maxItems)) dropped.push({ name: m.name, reason: `over the ${maxItems} item limit` });
  const items = bySize
    .slice(0, maxItems)
    .sort((a, b) => a.index - b.index)
    .map((m, i) => ({ ...m, index: i }));

  const segmentMs = Math.round(performance.now() - t1);
  log.info("detected", { listed: list.items.length, kept: items.length, dropped: dropped.length, listMs, segmentMs });
  return {
    items,
    dropped,
    notes,
    lister: { model: list.model, listed: list.items.length, usd: list.usd, cached: list.cached },
    timings: { listMs, segmentMs },
    samCalls,
  };
}
