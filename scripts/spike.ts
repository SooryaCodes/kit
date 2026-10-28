// End-to-end spike: photo → item list → SAM 3.1 masks → SAM 3D Objects GLBs → optimized GLBs.
// Writes everything to public/spike/ (viewable at /spike) plus spike-report.json.
//
//   pnpm spike                       all photos in test-photos/
//   pnpm spike bag-1 desk-2          only these
//   --mode combined|per-item|both    3D call strategy (default combined, per-item fallback)
//   --no-3d                          stop after masks
//   --vertex-colors                  ask fal for vertex colours instead of a baked texture
//   --max-items N                    cap items per photo (never above MAX_ITEMS_PER_JOB)
//
// Every paid call goes through lib/budget.ts. Each photo is one job with its own cap.

import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", quiet: true });

import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pLimit from "p-limit";
import { BudgetError, startJob, spendSummary, type JobBudget } from "../lib/budget";
import { CostLedger, PRICES, round } from "../lib/cost";
import { config } from "../lib/env";
import { uploadToFal } from "../lib/fal";
import { createLogger, errorMessage } from "../lib/log";
import { listItems, type ListResult } from "../lib/pipeline/list-items";
import { assignMatches, cropPng, dedupe, maskArea, maskPng, type ItemMask } from "../lib/pipeline/masks";
import { optimizeGlb } from "../lib/pipeline/optimize";
import { loadPhoto, type Photo } from "../lib/pipeline/photo";
import { downloadGlb, glbUrls, reconstruct, type ReconstructCall } from "../lib/pipeline/reconstruct";
import { hash } from "../lib/cache";
import { segmentBoxes, segmentPhrase, type SamMatch } from "../lib/sam";

const log = createLogger("spike");
const PHOTOS_DIR = path.join(process.cwd(), "test-photos");
const OUT_DIR = path.join(process.cwd(), "public", "spike");

type Mode = "combined" | "per-item" | "both";

interface Args {
  only: string[];
  mode: Mode;
  threeD: boolean;
  textured: boolean;
  maxItems: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { only: [], mode: "combined", threeD: true, textured: true, maxItems: config().MAX_ITEMS_PER_JOB };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--mode") args.mode = argv[++i] as Mode;
    else if (a === "--no-3d") args.threeD = false;
    else if (a === "--vertex-colors") args.textured = false;
    else if (a === "--max-items") args.maxItems = Math.min(Number(argv[++i]), config().MAX_ITEMS_PER_JOB);
    else if (!a.startsWith("--")) args.only.push(a.replace(/\.(jpe?g|png|webp)$/i, ""));
  }
  return args;
}

interface StepStat {
  ms: number;
  usd: number;
  calls?: number;
  cached?: number;
}

interface ItemReport {
  index: number;
  name: string;
  phrase: string;
  category: string;
  source: ItemMask["source"];
  confidence: number | null;
  flat: boolean;
  partial: boolean;
  areaPct: number;
  mask: string;
  crop: string;
  glb?: string;
  glbRaw?: string;
  glbPerItem?: string;
  bytesBefore?: number;
  bytesAfter?: number;
  trianglesBefore?: number;
  trianglesAfter?: number;
  textured?: boolean;
  size?: [number, number, number];
  reconstructMs?: number;
  error?: string;
  /** filled in by hand after looking at /spike: good | rough | bad */
  quality: null | "good" | "rough" | "bad";
}

interface PhotoReport {
  file: string;
  slug: string;
  photo: string;
  width: number;
  height: number;
  original: { width: number; height: number };
  lister: { model: string; attempts: number; listed: number; cached: boolean };
  phrases: number;
  steps: Record<string, StepStat>;
  items: ItemReport[];
  dropped: Array<{ name: string; reason: string }>;
  threeD?: {
    mode: Mode;
    combined?: { masks: number; glbs: number; ms: number; ok: boolean; error?: string };
    perItem?: { calls: number; ok: number; wallMs: number; avgCallMs: number };
  };
  cost: Record<string, number>;
  totalUsd: number;
  totalMs: number;
  notes: string[];
  status: "done" | "failed" | "budget_exceeded";
  error?: string;
  userMessage?: string;
}

const MIN_AREA_FRACTION = 0.001; // masks smaller than 0.1% of the photo are noise

async function segmentAll(photo: Photo, list: ListResult, ledger: CostLedger, notes: string[], job: JobBudget) {
  const limit = pLimit(6);
  const groups = new Map<string, typeof list.items>();
  for (const it of list.items) {
    const key = it.phrase.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }

  const t0 = performance.now();
  let calls = 0;
  let cachedCalls = 0;
  const masks: ItemMask[] = [];
  const misses: typeof list.items = [];
  let index = 0;
  const minArea = photo.width * photo.height * MIN_AREA_FRACTION;

  const results = await Promise.all(
    [...groups.entries()].map(([phrase, items]) =>
      limit(async () => {
        try {
          const res = await segmentPhrase(photo, phrase, job);
          return { phrase, items, res };
        } catch (err) {
          if (err instanceof BudgetError) throw err;
          log.error("phrase failed", { phrase, error: errorMessage(err) });
          return { phrase, items, res: undefined };
        }
      }),
    ),
  );

  for (const { phrase, items, res } of results) {
    calls++;
    if (!res) {
      misses.push(...items);
      continue;
    }
    if (res.cached) cachedCalls++;
    ledger.add({ step: "segment", model: "sam-3.1", usd: PRICES["sam-3.1-image"], cached: res.cached, detail: { phrase } });
    const { pairs, unmatchedItems, unmatchedMatches } = assignMatches(items, res.matches);
    for (const { item, match } of pairs) {
      masks.push(toMask(index++, item, match, "phrase"));
    }
    misses.push(...unmatchedItems);
    // SAM found more instances than the lister named: keep confident, non-trivial ones
    for (const m of unmatchedMatches) {
      if ((m.confidence ?? 0) >= 0.6 && maskArea(m) >= minArea) {
        const first = items[0]!;
        masks.push(toMask(index++, { ...first, name: first.name, partial: false }, m, "extra"));
      }
    }
  }

  if (misses.length) {
    notes.push(`${misses.length} item(s) had no phrase match; retried with box prompts: ${misses.map((m) => m.phrase).join(", ")}`);
    for (let i = 0; i < misses.length; i += 16) {
      const chunk = misses.slice(i, i + 16);
      try {
        const res = await segmentBoxes(
          photo,
          chunk.map((it, j) => ({ id: j + 1, box: it.pixelBox })),
          job,
        );
        calls++;
        if (res.cached) cachedCalls++;
        ledger.add({ step: "segment", model: "sam-3.1", usd: PRICES["sam-3.1-image"], cached: res.cached, detail: { boxes: chunk.length } });
        for (const m of res.matches) {
          const it = chunk[Number(m.objectId) - 1];
          if (it) masks.push(toMask(index++, it, m, "box"));
        }
      } catch (err) {
        if (err instanceof BudgetError) throw err;
        notes.push(`box prompt fallback failed: ${errorMessage(err)}`);
      }
    }
  }

  return { masks, ms: Math.round(performance.now() - t0), calls, cachedCalls, phrases: groups.size };
}

function toMask(
  index: number,
  it: ListResult["items"][number],
  match: SamMatch,
  source: ItemMask["source"],
): ItemMask {
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

async function run3d(
  photo: Photo,
  slug: string,
  items: ItemReport[],
  maskBytes: Buffer[],
  args: Args,
  ledger: CostLedger,
  report: PhotoReport,
  job: JobBudget,
) {
  job.assertItems(items.length);
  const dir = path.join(OUT_DIR, slug);
  await mkdir(path.join(dir, "glb"), { recursive: true });
  await mkdir(path.join(dir, "glb-raw"), { recursive: true });

  const t0 = performance.now();
  const imageUrl = await uploadToFal(photo.bytes, "image/jpeg", `${slug}.jpg`);
  const uploads = pLimit(3);
  const maskUrls = await Promise.all(maskBytes.map((b, i) => uploads(() => uploadToFal(b, "image/png", `${slug}-mask-${i}.png`))));
  const maskHashes = maskBytes.map((b) => hash(b));
  report.steps.upload = { ms: Math.round(performance.now() - t0), usd: 0 };

  const opts = { textured: args.textured, seed: 42 };
  const glbFor: Array<{ url: string; ms: number } | undefined> = new Array(items.length);
  const perItemGlb: Array<{ url: string; ms: number } | undefined> = new Array(items.length);
  report.threeD = { mode: args.mode };

  let usd3d = 0;
  let ms3d = 0;
  let combinedOk = false;
  if (args.mode !== "per-item" && items.length > 1) {
    try {
      const call: ReconstructCall = await reconstruct(imageUrl, maskUrls, [photo.hash, ...maskHashes], opts, `${slug} combined`, job);
      usd3d += call.usd;
      ms3d += call.ms;
      ledger.add({ step: "reconstruct", model: "fal-sam-3d-objects", usd: call.usd, cached: call.cached, detail: { masks: items.length } });
      const urls = glbUrls(call.output);
      combinedOk = urls.length === items.length;
      report.threeD.combined = { masks: items.length, glbs: urls.length, ms: call.ms, ok: combinedOk };
      if (!combinedOk) report.notes.push(`combined call returned ${urls.length} GLBs for ${items.length} masks`);
      const metaIdx = call.output.metadata.map((m) => m.object_index);
      if (metaIdx.some((v, i) => v !== undefined && v !== i)) report.notes.push(`combined metadata object_index order: ${JSON.stringify(metaIdx)}`);
      urls.forEach((url, i) => {
        if (i < items.length) glbFor[i] = { url, ms: Math.round(call.ms / items.length) };
      });
    } catch (err) {
      if (err instanceof BudgetError) throw err;
      report.threeD.combined = { masks: items.length, glbs: 0, ms: 0, ok: false, error: errorMessage(err) };
      report.notes.push(`combined call failed: ${errorMessage(err)}`);
    }
  }

  const needPerItem = args.mode === "per-item" || args.mode === "both" || !combinedOk;
  if (needPerItem) {
    const limit = pLimit(6);
    const t1 = performance.now();
    const calls = await Promise.all(
      items.map((it, i) =>
        limit(async () => {
          try {
            const call = await reconstruct(imageUrl, [maskUrls[i]!], [photo.hash, maskHashes[i]!], opts, `${slug} #${i} ${it.name}`, job);
            ledger.add({ step: "reconstruct", model: "fal-sam-3d-objects", usd: call.usd, cached: call.cached, detail: { item: it.name } });
            const url = glbUrls(call.output)[0];
            return url ? { url, ms: call.ms, usd: call.usd } : undefined;
          } catch (err) {
            if (err instanceof BudgetError) throw err;
            it.error = errorMessage(err);
            return undefined;
          }
        }),
      ),
    );
    const ok = calls.filter(Boolean) as Array<{ url: string; ms: number; usd: number }>;
    const wallMs = Math.round(performance.now() - t1);
    report.threeD.perItem = {
      calls: items.length,
      ok: ok.length,
      wallMs,
      avgCallMs: ok.length ? Math.round(ok.reduce((s, c) => s + c.ms, 0) / ok.length) : 0,
    };
    calls.forEach((c, i) => {
      if (!c) return;
      perItemGlb[i] = c;
      if (!combinedOk) glbFor[i] = c;
      usd3d += c.usd;
    });
    ms3d += wallMs;
  }
  report.steps.reconstruct = { ms: ms3d, usd: round(usd3d) };

  // download + optimize
  const t2 = performance.now();
  const limit = pLimit(4);
  await Promise.all(
    items.map((it, i) =>
      limit(async () => {
        const primary = glbFor[i];
        if (!primary) {
          it.error ??= "no GLB returned";
          return;
        }
        try {
          const raw = await downloadGlb(primary.url);
          const opt = await optimizeGlb(raw);
          const rawName = `glb-raw/${it.index}.glb`;
          const optName = `glb/${it.index}.glb`;
          await writeFile(path.join(dir, rawName), raw);
          await writeFile(path.join(dir, optName), opt.glb);
          Object.assign(it, {
            glb: `/spike/${slug}/${optName}`,
            glbRaw: `/spike/${slug}/${rawName}`,
            bytesBefore: opt.bytesBefore,
            bytesAfter: opt.bytesAfter,
            trianglesBefore: opt.trianglesBefore,
            trianglesAfter: opt.trianglesAfter,
            textured: opt.hasTexture,
            size: opt.size,
            reconstructMs: primary.ms,
          });
          const alt = perItemGlb[i];
          if (combinedOk && alt) {
            const altOpt = await optimizeGlb(await downloadGlb(alt.url));
            const altName = `glb/${it.index}-single.glb`;
            await writeFile(path.join(dir, altName), altOpt.glb);
            it.glbPerItem = `/spike/${slug}/${altName}`;
          }
        } catch (err) {
          it.error = `optimize: ${errorMessage(err)}`;
          log.error("optimize failed", { slug, item: it.name, error: it.error });
        }
      }),
    ),
  );
  report.steps.optimize = { ms: Math.round(performance.now() - t2), usd: 0 };
}

async function runPhoto(file: string, args: Args): Promise<PhotoReport> {
  const slug = path.basename(file).replace(/\.[^.]+$/, "");
  const plog = log.child(slug);
  const dir = path.join(OUT_DIR, slug);
  await mkdir(path.join(dir, "masks"), { recursive: true });
  await mkdir(path.join(dir, "crops"), { recursive: true });
  const ledger = new CostLedger();
  const notes: string[] = [];
  const start = performance.now();

  const [photo, resizeMs] = await plog.time("resize", () => loadPhoto(path.join(PHOTOS_DIR, file)));
  await writeFile(path.join(dir, "photo.jpg"), photo.bytes);

  const report: PhotoReport = {
    file,
    slug,
    photo: `/spike/${slug}/photo.jpg`,
    width: photo.width,
    height: photo.height,
    original: { width: photo.originalWidth, height: photo.originalHeight },
    lister: { model: "", attempts: 0, listed: 0, cached: false },
    phrases: 0,
    steps: { resize: { ms: resizeMs, usd: 0 } },
    items: [],
    dropped: [],
    cost: {},
    totalUsd: 0,
    totalMs: 0,
    notes,
    status: "done",
  };

  try {
    const job = await startJob(`spike-${slug}-${Date.now()}`);
    const [list, listMs] = await plog.time("list items", () => listItems(photo, job));
    ledger.add({ step: "list", model: list.model, usd: list.usd, cached: list.cached, detail: { usage: list.usage } });
    report.lister = { model: list.model, attempts: list.attempts, listed: list.items.length, cached: list.cached };
    report.steps.list = { ms: listMs, usd: round(list.usd) };
    plog.info("items listed", { items: list.items.map((i) => i.phrase) });

    const seg = await segmentAll(photo, list, ledger, notes, job);
    report.phrases = seg.phrases;
    report.steps.segment = { ms: seg.ms, usd: ledger.total("segment"), calls: seg.calls, cached: seg.cachedCalls };

    const minArea = photo.width * photo.height * MIN_AREA_FRACTION;
    const big = seg.masks.filter((m) => {
      if (m.area >= minArea) return true;
      report.dropped.push({ name: m.name, reason: `too small (${((m.area / (photo.width * photo.height)) * 100).toFixed(2)}% of photo)` });
      return false;
    });
    // items the lister saw as cut off, whose mask also runs into the photo edge, are slivers
    const whole = big.filter((m) => {
      const b = m.match.bounds;
      const touchesEdge = b.left <= 1 || b.top <= 1 || b.right >= photo.width - 1 || b.bottom >= photo.height - 1;
      if (m.partial && touchesEdge) {
        report.dropped.push({ name: m.name, reason: "cut off by the photo edge" });
        return false;
      }
      return true;
    });
    const { kept, dropped } = dedupe(whole);
    for (const d of dropped) report.dropped.push({ name: d.mask.name, reason: `duplicate of ${d.overlapsWith} (IoU ${d.iou})` });
    // over the item cap: keep the largest items, they read best in 3D
    const bySize = [...kept].sort((a, b) => b.area - a.area);
    const capped = bySize.slice(0, args.maxItems).sort((a, b) => a.index - b.index);
    for (const m of bySize.slice(args.maxItems)) report.dropped.push({ name: m.name, reason: `over item cap ${args.maxItems} (smallest dropped)` });
    plog.info("masks ready", { found: seg.masks.length, kept: capped.length, dropped: report.dropped.length });

    const maskBytes: Buffer[] = [];
    for (const m of capped) {
      const mask = await maskPng(m.match, photo.width, photo.height);
      const crop = await cropPng(photo.bytes, m.match, photo.width, photo.height);
      await writeFile(path.join(dir, "masks", `${m.index}.png`), mask);
      await writeFile(path.join(dir, "crops", `${m.index}.png`), crop);
      maskBytes.push(mask);
      report.items.push({
        index: m.index,
        name: m.name,
        phrase: m.phrase,
        category: m.category,
        source: m.source,
        confidence: m.confidence === null ? null : Math.round(m.confidence * 100) / 100,
        flat: m.flat,
        partial: m.partial,
        areaPct: Math.round((m.area / (photo.width * photo.height)) * 10000) / 100,
        mask: `/spike/${slug}/masks/${m.index}.png`,
        crop: `/spike/${slug}/crops/${m.index}.png`,
        quality: null,
      });
    }

    if (args.threeD && report.items.length) {
      await run3d(photo, slug, report.items, maskBytes, args, ledger, report, job);
    }
    report.notes.push(`job spend by model: ${JSON.stringify(job.byProvider())}`);
  } catch (err) {
    report.error = errorMessage(err);
    if (err instanceof BudgetError) {
      report.status = "budget_exceeded";
      report.userMessage = err.userMessage;
      plog.error("budget guard stopped this photo", { code: err.code, error: report.error });
    } else {
      report.status = "failed";
      plog.error("photo failed", { error: report.error });
    }
  }

  report.cost = ledger.byStep();
  report.totalUsd = ledger.total();
  report.totalMs = Math.round(performance.now() - start);
  plog.info("photo done", {
    items: report.items.length,
    glbs: report.items.filter((i) => i.glb).length,
    usd: report.totalUsd,
    s: Math.round(report.totalMs / 100) / 10,
  });
  return report;
}

async function writeReport(reports: PhotoReport[], args: Args) {
  const items = reports.flatMap((r) => r.items);
  const withGlb = items.filter((i) => i.glb);
  const totalUsd = round(reports.reduce((s, r) => s + r.totalUsd, 0));
  const summary = {
    runAt: new Date().toISOString(),
    settings: args,
    photos: reports.length,
    items: items.length,
    glbs: withGlb.length,
    totalUsd,
    usdPerItem: items.length ? round(totalUsd / items.length) : 0,
    usdPerPhoto: round(totalUsd / reports.length),
    avgSecondsPerPhoto: Math.round(reports.reduce((s, r) => s + r.totalMs, 0) / reports.length / 100) / 10,
  };
  await writeFile(path.join(OUT_DIR, "report.json"), JSON.stringify({ summary, reports }, null, 2));
  await copyFile(path.join(OUT_DIR, "report.json"), path.join(process.cwd(), "spike-report.json"));
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = (await readdir(PHOTOS_DIR))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .filter((f) => !args.only.length || args.only.includes(f.replace(/\.[^.]+$/, "")))
    .sort();
  if (!files.length) throw new Error(`No photos found in ${PHOTOS_DIR}`);
  log.info("spike start", { photos: files.length, mode: args.mode, threeD: args.threeD, textured: args.textured, maxItems: args.maxItems });
  log.info("budget before run", await spendSummary());

  await mkdir(OUT_DIR, { recursive: true });
  const reports: PhotoReport[] = [];
  // photos run one after another so per-photo timings stay meaningful
  for (const f of files) {
    const r = await runPhoto(f, args);
    reports.push(r);
    // write after every photo so /spike shows results while a long run continues
    await writeReport(reports, args);
    // a provider or daily cap will refuse every later photo too; stop instead of hammering it
    if (r.status === "budget_exceeded" && !/cap_job|cap_items/.test(r.error ?? "")) {
      log.error("stopping run: budget guard refused", { error: r.error });
      break;
    }
  }

  const summary = await writeReport(reports, args);
  log.info("spike done", summary);
  log.info("budget after run", await spendSummary());
}

main().catch((err) => {
  log.error("spike crashed", { error: errorMessage(err) });
  process.exit(1);
});
