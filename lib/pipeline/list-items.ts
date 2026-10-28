// List every physical item in a photo as validated JSON.
// Primary: Muse Spark Open on Baseten (forced tool call, since JSON mode is unsupported there).
// Fallback: Muse Spark 1.3 on Meta Model API with json_schema structured output.

import { z } from "zod";
import type OpenAI from "openai";
import { baseten, basetenModel } from "../baseten";
import { cached, hash } from "../cache";
import { tokenCost, type TokenUsage } from "../cost";
import { BudgetError, paid, type JobBudget } from "../budget";
import { hasSecret } from "../env";
import { createLogger, errorMessage } from "../log";
import { META_MODELS, meta } from "../meta";
import type { Photo } from "./photo";
import type { PixelBox } from "../sam";

const log = createLogger("list-items");

export const CATEGORIES = [
  "electronics",
  "accessory",
  "bag",
  "clothing",
  "footwear",
  "jewelry",
  "beauty",
  "stationery",
  "book",
  "food_drink",
  "decor",
  "tool",
  "toy",
  "other",
] as const;

const NormBox = z.object({
  x_min: z.number().min(0).max(1000),
  y_min: z.number().min(0).max(1000),
  x_max: z.number().min(0).max(1000),
  y_max: z.number().min(0).max(1000),
});

export const ListedItem = z.object({
  name: z.string().min(1).describe("Natural display name, e.g. 'AirPods Pro case'"),
  category: z.enum(CATEGORIES),
  phrase: z
    .string()
    .min(1)
    .describe("Short noun phrase for a segmentation model: the object noun plus at most 2 visual attributes, e.g. 'white earbuds case'"),
  box: NormBox.describe("Approximate bounding box on a 0-1000 grid, (0,0) top-left"),
  flat: z.boolean().describe("True for thin flat things: cards, paper, stickers, cloth lying flat"),
  partial: z.boolean().describe("True if the item is cut off by the frame edge or mostly covered by another item"),
});

export const ItemList = z.object({
  items: z.array(ListedItem).max(40),
});

export type ListedItem = z.infer<typeof ListedItem>;
export type ItemList = z.infer<typeof ItemList>;

const JSON_SCHEMA = z.toJSONSchema(ItemList, { target: "draft-7" }) as Record<string, unknown>;

const PROMPT = `You are an object grounding expert preparing a photo for 3D reconstruction.
List every distinct physical item in this photo that a person owns or sells: things you could pick up.
Do not list the surface or background (table, floor, bedsheet, wall, desk mat, rug, doormat, tray the items sit on), shadows, or people.
List each separate object once. If there are more than 25 items, list only the 25 largest and most clearly visible ones. If there are several of the same kind (three pens), list each one separately with its own box.
For "phrase", write a short noun phrase a segmentation model can match: the object noun plus at most two visual attributes such as colour or material. No brand names, no spatial words, no verbs.
Boxes use a 0-1000 grid where (0,0) is the top-left and (1000,1000) the bottom-right of the image. Ensure the boxes accurately match each item and do not miss any objects.`;

export interface ListResult {
  items: Array<ListedItem & { pixelBox: PixelBox }>;
  model: string;
  usd: number;
  cached: boolean;
  attempts: number;
  usage?: TokenUsage;
}

type Lister = "open" | "spark";

const MAX_TOKENS = 12_000;
// worst case: ~3k input tokens (image + prompt) and every output token used
const ESTIMATE_USD = (3_000 * 1.25 + MAX_TOKENS * 4.25) / 1_000_000;

function toPixels(box: z.infer<typeof NormBox>, w: number, h: number): PixelBox {
  const x1 = Math.min(box.x_min, box.x_max);
  const x2 = Math.max(box.x_min, box.x_max);
  const y1 = Math.min(box.y_min, box.y_max);
  const y2 = Math.max(box.y_min, box.y_max);
  return {
    left: Math.max(0, Math.floor((x1 / 1000) * w)),
    top: Math.max(0, Math.floor((y1 / 1000) * h)),
    right: Math.min(w, Math.max(Math.ceil((x2 / 1000) * w), Math.floor((x1 / 1000) * w) + 1)),
    bottom: Math.min(h, Math.max(Math.ceil((y2 / 1000) * h), Math.floor((y1 / 1000) * h) + 1)),
  };
}

function parseCandidate(raw: string | undefined | null): unknown {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

async function callOpen(photo: Photo, retryNote?: string) {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: photo.dataUrl, detail: "high" } },
        { type: "text", text: PROMPT + (retryNote ? `\n\nYour previous answer was invalid: ${retryNote}. Call report_items again with valid arguments.` : "") + "\n\nCall the report_items tool with the full list." },
      ],
    },
  ];
  const res = await baseten().chat.completions.create({
    model: basetenModel(),
    messages,
    tools: [
      {
        type: "function",
        function: { name: "report_items", description: "Report every item found in the photo.", parameters: JSON_SCHEMA },
      },
    ],
    tool_choice: { type: "function", function: { name: "report_items" } },
    temperature: 0.2,
    max_tokens: MAX_TOKENS,
  });
  const msg = res.choices[0]?.message;
  const call = msg?.tool_calls?.find((c) => c.type === "function");
  const raw = call && call.type === "function" ? call.function.arguments : msg?.content;
  return { raw: raw ?? "", usage: res.usage as TokenUsage | undefined };
}

async function callSpark(photo: Photo, retryNote?: string) {
  const res = await meta().chat.completions.create({
    model: META_MODELS.spark,
    reasoning_effort: "low",
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: photo.dataUrl } },
          { type: "text", text: PROMPT + (retryNote ? `\n\nYour previous answer was invalid: ${retryNote}.` : "") },
        ],
      },
    ],
    response_format: { type: "json_schema", json_schema: { name: "ItemList", schema: JSON_SCHEMA } },
    max_tokens: MAX_TOKENS,
  });
  return { raw: res.choices[0]?.message?.content ?? "", usage: res.usage as TokenUsage | undefined };
}

async function listWith(lister: Lister, photo: Photo, job?: JobBudget) {
  const call = lister === "open" ? callOpen : callSpark;
  const priceModel = lister === "open" ? "muse-spark-open" : "muse-spark-1.3";
  const provider = lister === "open" ? "baseten" : "meta";
  const model = lister === "open" ? basetenModel() : META_MODELS.spark;
  let usd = 0;
  let lastError = "";
  // Muse Spark Open gets one repair attempt; Muse Spark 1.3 output is schema-constrained, so one call
  const attempts = lister === "open" ? 2 : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { raw, usage } = await paid(
      { provider, model, estimateUsd: ESTIMATE_USD, actualUsd: (r) => tokenCost(priceModel, r.usage), job, label: `list items #${attempt}` },
      () => call(photo, attempt > 1 ? lastError : undefined),
    );
    usd += tokenCost(priceModel, usage);
    const parsed = ItemList.safeParse(parseCandidate(raw));
    if (parsed.success) return { list: parsed.data, usd, attempts: attempt, usage };
    lastError = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ") || "output was not JSON";
    log.warn("invalid item list", { lister, attempt, error: lastError, sample: raw.slice(0, 200) });
  }
  throw new Error(`${lister} returned an invalid item list: ${lastError}`);
}

export async function listItems(photo: Photo, job?: JobBudget, prefer: Lister = "open"): Promise<ListResult> {
  const order: Lister[] = prefer === "open" && hasSecret("BASETEN_API_KEY") ? ["open", "spark"] : ["spark"];
  let lastErr: unknown;
  for (const lister of order) {
    const model = lister === "open" ? basetenModel() : META_MODELS.spark;
    try {
      const key = hash("list-items-v1", model, PROMPT, photo.hash);
      const { value, hit } = await cached("list-items", key, () => listWith(lister, photo, job));
      const items = value.list.items.map((it) => ({ ...it, pixelBox: toPixels(it.box, photo.width, photo.height) }));
      log.info("listed", { model, items: items.length, usd: value.usd, attempts: value.attempts, cached: hit });
      return { items, model, usd: hit ? 0 : value.usd, cached: hit, attempts: value.attempts, usage: value.usage };
    } catch (err) {
      if (err instanceof BudgetError) throw err;
      lastErr = err;
      log.warn("lister failed, trying next", { lister, error: errorMessage(err) });
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
