// Product details for a new shop page, in one Muse Spark call over the photo:
// a shop-ready name (with brand and model only when readable), a short description of what is visible,
// and the longest side in centimetres. These are suggestions; the seller checks them before publishing.

import "server-only";
import { z } from "zod";
import { paid, type JobBudget } from "../budget";
import { cached, hash } from "../cache";
import { tokenCost, type TokenUsage } from "../cost";
import { createLogger } from "../log";
import { META_MODELS, meta } from "../meta";

const log = createLogger("shop:details");

const PROMPT = `You are helping a small seller list the products in this photo.
For each numbered product below (its position is given as a box on a 0 to 1000 grid of the photo), return:
- name: a short shop name a buyer would search for, 2 to 5 words. Include a brand or model only if you can read it in the photo. Never invent one. Use Title Case. Never use position words (top, bottom, left, middle). When products differ only in colour, start the name with the colour ("Tan Leather Sling Bag").
- description: one sentence, at most 18 words, about the product itself: material, colour, features. Never mention the photo, the background, where it lies or how it is placed. No claims you cannot see (no "waterproof", "genuine leather" unless printed on it).
- size_cm: your best estimate of the product's longest side in centimetres, from what the product is and its size relative to the others.
- size_confidence: "high" when the product has a standard size (phone, A4 notebook, shoe), "medium" for typical sizes, "low" when it could vary a lot.
Return every product once, with its number.`;

const Detail = z.object({
  idx: z.number().int(),
  name: z.string().min(1).max(60),
  description: z.string().max(200),
  size_cm: z.number().positive().max(500),
  size_confidence: z.enum(["high", "medium", "low"]),
});
const Details = z.object({ products: z.array(Detail) });
export type ProductDetail = z.infer<typeof Detail>;

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["products"],
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["idx", "name", "description", "size_cm", "size_confidence"],
        properties: {
          idx: { type: "integer" },
          name: { type: "string" },
          description: { type: "string" },
          size_cm: { type: "number" },
          size_confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
  },
} as const;

export interface DetailInput {
  idx: number;
  name: string;
  /** item box in photo pixels */
  box: { left: number; top: number; right: number; bottom: number };
}

export async function describeProducts(
  photo: { dataUrl: string; hash: string; width: number; height: number },
  items: DetailInput[],
  job?: JobBudget,
): Promise<ProductDetail[]> {
  const list = items
    .map((i) => {
      const g = (v: number, d: number) => Math.round((v / d) * 1000);
      return `${i.idx}. ${i.name} [${g(i.box.left, photo.width)}, ${g(i.box.top, photo.height)}, ${g(i.box.right, photo.width)}, ${g(i.box.bottom, photo.height)}]`;
    })
    .join("\n");
  const key = hash("shop-details-v3", META_MODELS.spark, PROMPT, photo.hash, list);

  const { value, hit } = await cached(
    "shop-details",
    key,
    async () => {
      const res = await paid(
        { provider: "meta", model: META_MODELS.spark, estimateUsd: 0.02, actualUsd: (r) => tokenCost("muse-spark-1.3", r.usage as TokenUsage), job, label: "shop details" },
        () =>
          meta().chat.completions.create({
            model: META_MODELS.spark,
            reasoning_effort: "low",
            messages: [
              {
                role: "user",
                content: [
                  { type: "image_url", image_url: { url: photo.dataUrl } },
                  { type: "text", text: `${PROMPT}\n\nProducts:\n${list}` },
                ],
              },
            ],
            response_format: { type: "json_schema", json_schema: { name: "ProductDetails", schema: JSON_SCHEMA } },
            max_tokens: 4000,
          }),
      );
      const parsed = Details.parse(JSON.parse(res.choices[0]?.message?.content ?? "{}"));
      return parsed.products;
    },
    { store: "db" },
  );
  log.info("described", { products: value.length, cached: hit });
  return value;
}
