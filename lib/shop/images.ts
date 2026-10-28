// Product pictures for a shop, built around the real cut-out so the product itself is never redrawn:
//   backdrop     one empty, shop-wide backdrop from Muse Image ($0.01, generated once per page)
//   styled shot  the real cut-out with a soft shadow on that backdrop
//   size picture the cut-out next to an everyday object (phone, A4 sheet, 14-inch laptop) drawn to exact scale.
//                Shapes only, no text: the caption is set in the page, so fonts never depend on the server.

import "server-only";
import sharp from "sharp";
import { paid } from "../budget";
import { PRICES } from "../cost";
import { config, secret } from "../env";
import { createLogger } from "../log";
import { META_MODELS } from "../meta";
import { supabaseAdmin } from "../supabase/server";
import { downloadFile, uploadFile } from "../supabase/storage";
import { referenceFor } from "./links";

const log = createLogger("shop:images");

const SIZE = 1080;
const BACKDROP_PROMPT =
  "An empty seamless studio backdrop for small product photos, seen straight from above: soft warm off-white paper with a subtle natural texture, gentle daylight from the top left, a faint vignette. Completely empty: no objects, no props, no shadows of objects, no text, no logos.";

async function exists(bucket: "covers", path: string): Promise<boolean> {
  const dir = path.split("/").slice(0, -1).join("/");
  const name = path.split("/").pop()!;
  const { data } = await supabaseAdmin().storage.from(bucket).list(dir, { search: name });
  return Boolean(data?.some((f) => f.name === name));
}

/** The shop's backdrop: generated once with Muse Image, then reused for every product picture. */
export async function shopBackdrop(pageId: string): Promise<Buffer> {
  const path = `backdrops/${pageId}.jpg`;
  if (await exists("covers", path)) return downloadFile("covers", path);

  const res = await paid({ provider: "meta", model: META_MODELS.image, estimateUsd: PRICES["muse-image-1.0"], label: `backdrop ${pageId.slice(0, 8)}` }, async () => {
    const r = await fetch(`${config().META_API_BASE_URL}/images/generations`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret("META_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: META_MODELS.image,
        prompt: BACKDROP_PROMPT,
        n: 1,
        size: "1024x1024",
        output_format: "jpeg",
        reasoning_strength: "low",
        tool_enablement: { enable_image_search: false, enable_web_search: false, enable_shell: false },
      }),
    });
    if (!r.ok) throw Object.assign(new Error(`Muse Image ${r.status}: ${(await r.text()).slice(0, 200)}`), { status: r.status });
    return (await r.json()) as { data?: { b64_json?: string }[] };
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("Muse Image returned no image");
  const out = await sharp(Buffer.from(b64, "base64")).resize(SIZE, SIZE, { fit: "cover" }).jpeg({ quality: 90 }).toBuffer();
  await uploadFile("covers", path, out, "image/jpeg");
  log.info("backdrop generated", { page: pageId });
  return out;
}

/** Pulls the mask edge in by a couple of pixels, so no background fringe from the photo shows as a halo. */
async function cleanEdge(cutout: Buffer): Promise<Buffer> {
  const rgb = await sharp(cutout).removeAlpha().toBuffer();
  const alpha = await sharp(cutout).extractChannel(3).blur(2).threshold(235).blur(0.6).toBuffer();
  return sharp(rgb).joinChannel(alpha).png().toBuffer();
}

/** A soft contact shadow under the cut-out, from its own alpha. */
async function shadowFor(cutout: Buffer, width: number, height: number): Promise<Buffer> {
  const alpha = await sharp(cutout).resize(width, height).extractChannel("alpha").toBuffer();
  return sharp({ create: { width, height, channels: 3, background: { r: 40, g: 30, b: 20 } } })
    .joinChannel(await sharp(alpha).linear(0.38, 0).toBuffer())
    .blur(14)
    .png()
    .toBuffer();
}

async function placed(cutout: Buffer, boxW: number, boxH: number) {
  const img = sharp(await cleanEdge(cutout)).trim({ threshold: 1 });
  const meta = await img.metadata();
  const trimmed = await img.png().toBuffer();
  const k = Math.min(boxW / (meta.width ?? 1), boxH / (meta.height ?? 1));
  const width = Math.max(1, Math.round((meta.width ?? 1) * k));
  const height = Math.max(1, Math.round((meta.height ?? 1) * k));
  return { png: await sharp(trimmed).resize(width, height).png().toBuffer(), width, height, longest: Math.max(meta.width ?? 1, meta.height ?? 1) };
}

/** The real cut-out on the shop backdrop, centred with a soft shadow. */
export async function styledShot(backdrop: Buffer, cutout: Buffer): Promise<Buffer> {
  const p = await placed(cutout, SIZE * 0.66, SIZE * 0.66);
  const left = Math.round((SIZE - p.width) / 2);
  const top = Math.round((SIZE - p.height) / 2);
  const shadow = await shadowFor(p.png, p.width, p.height);
  return sharp(backdrop)
    .resize(SIZE, SIZE)
    .composite([
      { input: shadow, left: left + 10, top: top + 22 },
      { input: p.png, left, top },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

/** Outline of the reference object, drawn to scale in a box of w x h pixels. */
function referenceSvg(kind: ReturnType<typeof referenceFor>["kind"], w: number, h: number): string {
  const ink = "#161514";
  const stroke = Math.max(3, Math.round(Math.min(w, h) * 0.02));
  const r = kind === "phone" ? Math.round(Math.min(w, h) * 0.16) : Math.round(Math.min(w, h) * 0.03);
  const inset = stroke * 3;
  const inner =
    kind === "phone"
      ? `<rect x="${inset}" y="${inset * 1.6}" width="${w - inset * 2}" height="${h - inset * 3.2}" rx="${r * 0.6}" fill="${ink}" fill-opacity="0.08"/>`
      : kind === "laptop"
        ? `<rect x="${inset * 1.5}" y="${inset * 1.5}" width="${w - inset * 3}" height="${h - inset * 3}" rx="${r}" fill="none" stroke="${ink}" stroke-opacity="0.25" stroke-width="${stroke * 0.6}"/>`
        : Array.from({ length: 6 }, (_, i) => `<line x1="${inset}" x2="${w - inset * (i % 2 ? 2 : 1)}" y1="${inset + (i + 1) * (h / 9)}" y2="${inset + (i + 1) * (h / 9)}" stroke="${ink}" stroke-opacity="0.12" stroke-width="${stroke * 0.5}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="${stroke / 2}" y="${stroke / 2}" width="${w - stroke}" height="${h - stroke}" rx="${r}" fill="#fbfaf8" fill-opacity="0.9" stroke="${ink}" stroke-width="${stroke}"/>${inner}</svg>`;
}

/** A 10 cm scale bar with 1 cm ticks, so the picture carries its own scale without any text. */
function scaleBarSvg(pxPerCm: number): { svg: string; width: number; height: number } {
  const width = Math.round(pxPerCm * 10);
  const height = 22;
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const x = Math.round(i * pxPerCm);
    const tall = i % 5 === 0;
    return `<line x1="${x + 1}" x2="${x + 1}" y1="${tall ? 0 : 8}" y2="${height}" stroke="#161514" stroke-width="2"/>`;
  }).join("");
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width + 2}" height="${height}"><line x1="1" x2="${width + 1}" y1="${height - 1}" y2="${height - 1}" stroke="#161514" stroke-width="2"/>${ticks}</svg>`, width: width + 2, height };
}

/**
 * The product next to its reference object, both at the same pixels-per-centimetre.
 * The product's longest side in the photo is scaled to its confirmed real size; the reference uses its real dimensions.
 */
export async function sizePicture(backdrop: Buffer, cutout: Buffer, sizeM: number): Promise<Buffer> {
  const ref = referenceFor(sizeM);
  const productCm = sizeM * 100;
  const margin = 90;
  const gap = 70;
  // both objects side by side, the larger one sets the scale
  const pxPerCm = Math.min((SIZE - margin * 2 - gap) / (productCm + ref.widthCm), (SIZE - margin * 2 - 80) / Math.max(productCm, ref.heightCm));

  const trimmed = await sharp(await cleanEdge(cutout)).trim({ threshold: 1 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const k = (productCm * pxPerCm) / Math.max(meta.width ?? 1, meta.height ?? 1);
  const pw = Math.max(1, Math.round((meta.width ?? 1) * k));
  const ph = Math.max(1, Math.round((meta.height ?? 1) * k));
  const product = await sharp(trimmed).resize(pw, ph).png().toBuffer();
  const rw = Math.round(ref.widthCm * pxPerCm);
  const rh = Math.round(ref.heightCm * pxPerCm);

  const total = pw + gap + rw;
  const left = Math.round((SIZE - total) / 2);
  const baseline = Math.round(SIZE / 2 + Math.max(ph, rh) / 2) - 20;
  const bar = scaleBarSvg(pxPerCm);
  const shadow = await shadowFor(product, pw, ph);

  return sharp(backdrop)
    .resize(SIZE, SIZE)
    .composite([
      { input: Buffer.from(referenceSvg(ref.kind, rw, rh)), left: left + pw + gap, top: baseline - rh },
      { input: shadow, left: left + 8, top: baseline - ph + 16 },
      { input: product, left, top: baseline - ph },
      { input: Buffer.from(bar.svg), left: Math.round((SIZE - bar.width) / 2), top: Math.min(SIZE - 60, baseline + 40) },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

/** Builds and stores the size picture for one item; returns its storage path in the covers bucket. */
export async function makeSizePicture(pageId: string, item: { id: string; crop_path: string | null; real_size_m: number | null }): Promise<string> {
  if (!item.crop_path || !item.real_size_m) throw new Error("the product needs a cut-out and a confirmed size first");
  const [backdrop, cutout] = await Promise.all([shopBackdrop(pageId), downloadFile("crops", item.crop_path)]);
  const path = `size/${item.id}-${Math.round(Number(item.real_size_m) * 1000)}mm.jpg`;
  await uploadFile("covers", path, await sizePicture(backdrop, cutout, Number(item.real_size_m)), "image/jpeg");
  return path;
}

/** Builds and stores the styled shot for one item; returns its storage path in the covers bucket. */
export async function makeStyledShot(pageId: string, item: { id: string; crop_path: string | null }): Promise<string> {
  if (!item.crop_path) throw new Error("the product needs a cut-out first");
  const [backdrop, cutout] = await Promise.all([shopBackdrop(pageId), downloadFile("crops", item.crop_path)]);
  const path = `styled/${item.id}.jpg`;
  await uploadFile("covers", path, await styledShot(backdrop, cutout), "image/jpeg");
  return path;
}
