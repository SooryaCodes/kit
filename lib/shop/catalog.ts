// A shop as a Meta product catalog feed (CSV), so the same products show up in the seller's WhatsApp Business
// catalog, on Instagram and Facebook, and in catalog ads, every one linking back to its 3D page.
// Format: https://developers.facebook.com/docs/marketing-api/catalog/reference
//   category  Muse Spark picks each product's Google product category from the list Meta accepts, once per
//             product; the answer is checked against that list and stored, so the hourly feed fetch costs nothing
//   image     the styled shot when there is one, else the real cut-out centred on white (1080 px JPEG)

import "server-only";
import sharp from "sharp";
import { z } from "zod";
import { paid } from "../budget";
import { cached, hash } from "../cache";
import { tokenCost, type TokenUsage } from "../cost";
import { createLogger, errorMessage } from "../log";
import { META_MODELS, meta } from "../meta";
import { supabaseAdmin } from "../supabase/server";
import { downloadFile, publicUrl, uploadFile } from "../supabase/storage";
import { CATEGORIES } from "./taxonomy";

const log = createLogger("shop:catalog");

const PATHS = CATEGORIES.map(([, path]) => path);
const ID_BY_PATH = new Map(CATEGORIES.map(([id, path]) => [path, id]));

const PROMPT = `Pick the best product category for each product a small shop sells, from the allowed list only.
Choose the most specific category that fits. A leather sling bag is "Apparel & Accessories > Handbags, Wallets & Cases"; earrings are "Apparel & Accessories > Jewelry".`;

const Categorized = z.object({ products: z.array(z.object({ id: z.string(), category: z.string() })) });

async function categorize(products: { id: string; name: string; description: string | null }[]): Promise<Map<string, number>> {
  const list = products.map((p) => ({ id: p.id, name: p.name, description: p.description ?? "" }));
  const key = hash("catalog-category-v1", META_MODELS.spark, PROMPT, JSON.stringify(list));
  const { value } = await cached(
    "catalog-category",
    key,
    async () => {
      const res = await paid(
        { provider: "meta", model: META_MODELS.spark, estimateUsd: 0.01, actualUsd: (r) => tokenCost("muse-spark-1.3", r.usage as TokenUsage), label: "catalog categories" },
        () =>
          meta().chat.completions.create({
            model: META_MODELS.spark,
            reasoning_effort: "low",
            messages: [{ role: "user", content: `${PROMPT}\n\nProducts:\n${JSON.stringify(list)}` }],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "Categories",
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["products"],
                  properties: {
                    products: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        required: ["id", "category"],
                        properties: { id: { type: "string" }, category: { type: "string", enum: PATHS } },
                      },
                    },
                  },
                },
              },
            },
            max_tokens: 2000,
          }),
      );
      return Categorized.parse(JSON.parse(res.choices[0]?.message?.content ?? "{}"));
    },
    { store: "db" },
  );
  const out = new Map<string, number>();
  for (const p of value.products) {
    const id = ID_BY_PATH.get(p.category);
    if (id !== undefined) out.set(p.id, id);
  }
  return out;
}

/** The real cut-out centred on white, 1080 px square: what Meta wants when there is no styled shot. */
async function plainImage(item: { id: string; crop_path: string }): Promise<string> {
  const SIZE = 1080;
  const cutout = await sharp(await downloadFile("crops", item.crop_path))
    .trim()
    .resize(Math.round(SIZE * 0.8), Math.round(SIZE * 0.8), { fit: "inside" })
    .toBuffer();
  const jpeg = await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: "#ffffff" } })
    .composite([{ input: cutout, gravity: "centre" }])
    .jpeg({ quality: 88 })
    .toBuffer();
  const path = `catalog/${item.id}.jpg`;
  await uploadFile("covers", path, jpeg, "image/jpeg");
  await supabaseAdmin().from("items").update({ catalog_image_path: path }).eq("id", item.id);
  return path;
}

const COLUMNS = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "additional_image_link", "brand", "google_product_category", "product_type", "custom_label_0"] as const;

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const CURRENCY: Record<string, string> = { "₹": "INR", $: "USD", "€": "EUR", "£": "GBP" };

/** The feed for a published shop, or null when there is no such shop. Products without a price are left out. */
export async function catalogFeed(slug: string, origin: string): Promise<{ csv: string; count: number } | null> {
  const db = supabaseAdmin();
  const { data: page } = await db.from("pages").select("id, job_id, title, published").eq("slug", slug).maybeSingle();
  if (!page?.published) return null;
  const { data: rows } = await db
    .from("items")
    .select("id, name, description, price, currency, real_size_m, sold_out, crop_path, styled_image_path, size_image_path, catalog_image_path, product_category, display_order, idx")
    .eq("job_id", page.job_id)
    .eq("status", "ready")
    .eq("hidden", false)
    .not("price", "is", null)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("idx");
  const items = rows ?? [];

  const missing = items.filter((i) => i.product_category === null);
  if (missing.length) {
    try {
      const found = await categorize(missing);
      await Promise.all([...found].map(([id, category]) => db.from("items").update({ product_category: category }).eq("id", id)));
      for (const i of missing) i.product_category = found.get(i.id) ?? null;
    } catch (err) {
      log.warn("categories failed, feed goes out without them", { slug, error: errorMessage(err) });
    }
  }

  const lines = [COLUMNS.join(",")];
  for (const i of items) {
    let image = i.styled_image_path ? publicUrl("covers", i.styled_image_path) : i.catalog_image_path ? publicUrl("covers", i.catalog_image_path) : null;
    if (!image && i.crop_path) image = publicUrl("covers", await plainImage({ id: i.id, crop_path: i.crop_path }));
    if (!image) continue;
    const size = i.real_size_m === null ? "" : ` About ${Math.round(Number(i.real_size_m) * 100)} cm on its longest side.`;
    const category = i.product_category === null ? null : CATEGORIES.find(([id]) => id === i.product_category);
    const row: Record<(typeof COLUMNS)[number], string> = {
      id: i.id,
      title: i.name.slice(0, 150),
      description: `${i.description ?? i.name}${size} See it in 3D and in your room at real size.`.slice(0, 5000),
      availability: i.sold_out ? "out of stock" : "in stock",
      condition: "new",
      price: `${Number(i.price).toFixed(2)} ${CURRENCY[i.currency ?? "₹"] ?? "INR"}`,
      link: `${origin}/k/${slug}?p=${i.id}`,
      image_link: image,
      additional_image_link: i.size_image_path ? publicUrl("covers", i.size_image_path) : "",
      brand: page.title.slice(0, 100),
      google_product_category: category ? String(category[0]) : "",
      product_type: category ? category[1] : "",
      custom_label_0: "3D and real-size AR",
    };
    lines.push(COLUMNS.map((c) => csvCell(row[c])).join(","));
  }
  log.info("feed", { slug, products: lines.length - 1 });
  return { csv: `${lines.join("\n")}\n`, count: lines.length - 1 };
}
