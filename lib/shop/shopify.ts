// Import from a Shopify store, with no app and no login: every Shopify store publishes its products at
// /products.json and its name, city and currency at /meta.json. Kit lays the first product photo of up to twelve
// products out as one grid image on white and runs it through the usual pipeline (find, cut out, rebuild in 3D);
// each product found is matched back to its grid cell, so it keeps its real name, price, description and link.

import "server-only";
import sharp from "sharp";
import { z } from "zod";
import { createLogger } from "../log";

const log = createLogger("shop:shopify");

const MAX_PRODUCTS = 12;
const CELL = 600;
const GAP = 60;

export class ImportError extends Error {}

export interface ShopifyProduct {
  title: string;
  price: number | null;
  description: string;
  url: string;
}

/** What the job keeps so the draft page can give each product its store details back. */
export interface ShopifySource {
  kind: "shopify";
  store: { name: string; url: string; city: string | null; currency: string };
  width: number;
  height: number;
  cells: { x: number; y: number; w: number; h: number; product: ShopifyProduct }[];
}

const ProductsJson = z.object({
  products: z.array(
    z.object({
      title: z.string(),
      handle: z.string(),
      body_html: z.string().nullable().optional(),
      variants: z.array(z.object({ price: z.string().nullable().optional(), available: z.boolean().optional() })).default([]),
      images: z.array(z.object({ src: z.string().url() })).default([]),
    }),
  ),
});
const MetaJson = z.object({ name: z.string().optional(), city: z.string().nullable().optional(), currency: z.string().optional() });

/** "mystore.com", "https://mystore.com/collections/x" or "mystore.myshopify.com" → "https://mystore.com" */
export function storeOrigin(input: string): string {
  const raw = input.trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new ImportError("That doesn't look like a store address. Try yourstore.com.");
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || /^(localhost|\d+\.\d+\.\d+\.\d+)$/.test(url.hostname)) {
    throw new ImportError("That doesn't look like a store address. Try yourstore.com.");
  }
  return `https://${url.hostname.toLowerCase()}`;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; Kit/1.0)", accept: "application/json" }, signal: AbortSignal.timeout(15_000), redirect: "follow" });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

function plainText(html: string | null | undefined): string {
  return (html ?? "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** "boAt Stone 180 | Bluetooth Speaker with 5W sound" → "boAt Stone 180"; long titles end on a whole word. */
export function shortTitle(title: string): string {
  const head = title.split(/\s[|–—]\s/)[0]!.trim();
  if (head.length <= 60) return head;
  return head.slice(0, 60).replace(/\s+\S*$/, "");
}

/** The store's products (first image of each, available ones first) and a grid photo of them on white. */
export async function importShopify(input: string): Promise<{ photo: Buffer; source: ShopifySource }> {
  const origin = storeOrigin(input);
  let parsed: z.infer<typeof ProductsJson>;
  try {
    parsed = ProductsJson.parse(await getJson(`${origin}/products.json?limit=60`));
  } catch (err) {
    log.info("not a shopify store", { origin, error: err instanceof Error ? err.message : String(err) });
    throw new ImportError("Kit couldn't read products from that address. Is it a Shopify store?");
  }
  const meta = MetaJson.safeParse(await getJson(`${origin}/meta.json`).catch(() => ({})));
  const store = {
    name: (meta.success && meta.data.name) || new URL(origin).hostname.replace(/^www\./, ""),
    url: origin,
    city: (meta.success && meta.data.city) || null,
    currency: (meta.success && meta.data.currency) || "INR",
  };

  const picked = parsed.products
    .filter((p) => p.images.length)
    .sort((a, b) => Number(b.variants.some((v) => v.available !== false)) - Number(a.variants.some((v) => v.available !== false)))
    .slice(0, MAX_PRODUCTS);
  if (picked.length < 2) throw new ImportError("That store has fewer than two products with photos.");

  // Shopify's image CDN resizes on request
  const images = await Promise.all(
    picked.map(async (p) => {
      const src = new URL(p.images[0]!.src);
      // only Shopify's own image CDN or the store itself: the list comes from the store, not from us
      if (src.hostname !== "cdn.shopify.com" && `https://${src.hostname}` !== origin) return null;
      src.searchParams.set("width", "800");
      const res = await fetch(src, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) return null;
      const fitted = await sharp(Buffer.from(await res.arrayBuffer()))
        .flatten({ background: "#ffffff" })
        .resize(CELL, CELL, { fit: "contain", background: "#ffffff" })
        .jpeg()
        .toBuffer();
      return { product: p, fitted };
    }),
  );
  const ok = images.filter((i): i is NonNullable<typeof i> => i !== null);
  if (ok.length < 2) throw new ImportError("Kit couldn't download that store's product photos.");

  const cols = ok.length <= 4 ? ok.length : ok.length <= 9 ? 3 : 4;
  const rows = Math.ceil(ok.length / cols);
  const width = GAP + cols * (CELL + GAP);
  const height = GAP + rows * (CELL + GAP);
  const cells = ok.map((o, n) => ({ x: GAP + (n % cols) * (CELL + GAP), y: GAP + Math.floor(n / cols) * (CELL + GAP), w: CELL, h: CELL, o }));
  const photo = await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
    .composite(cells.map((c) => ({ input: c.o.fitted, left: c.x, top: c.y })))
    .jpeg({ quality: 90 })
    .toBuffer();

  const source: ShopifySource = {
    kind: "shopify",
    store,
    width,
    height,
    cells: cells.map((c) => {
      const price = Number(c.o.product.variants[0]?.price);
      return {
        x: c.x,
        y: c.y,
        w: c.w,
        h: c.h,
        product: {
          title: shortTitle(c.o.product.title),
          price: Number.isFinite(price) && price > 0 ? price : null,
          description: plainText(c.o.product.body_html).slice(0, 400),
          url: `${origin}/products/${c.o.product.handle}`,
        },
      };
    }),
  };
  log.info("imported", { origin, products: source.cells.length, width, height });
  return { photo, source };
}

/** The grid cell an item found on the import photo sits in (by the centre of its box), or null. */
export function cellFor(source: ShopifySource, box: { left: number; top: number; right: number; bottom: number }, photoWidth: number): ShopifySource["cells"][number] | null {
  // the stored photo may have been scaled down from the composed grid
  const k = source.width / photoWidth;
  const cx = ((box.left + box.right) / 2) * k;
  const cy = ((box.top + box.bottom) / 2) * k;
  return source.cells.find((c) => cx >= c.x - 30 && cx <= c.x + c.w + 30 && cy >= c.y - 30 && cy <= c.y + c.h + 30) ?? null;
}

export function isShopifySource(v: unknown): v is ShopifySource {
  return typeof v === "object" && v !== null && (v as { kind?: unknown }).kind === "shopify";
}
