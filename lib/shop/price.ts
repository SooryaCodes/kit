// Price check: Muse Spark searches the web (search grounding) for what similar products sell for in India and
// returns a range with the pages it cited. Shown to the seller only when at least two real sources back it;
// the seller always sets the price themselves.

import "server-only";
import type OpenAI from "openai";
import { paid } from "../budget";
import { cached, hash } from "../cache";
import { responsesCost, type ResponsesUsage } from "../cost";
import { createLogger } from "../log";
import { META_MODELS, meta } from "../meta";
import { supabaseAdmin } from "../supabase/server";
import { checkToken, EditError } from "./editor";

const log = createLogger("shop:price");

export interface PriceCheck {
  low: number;
  high: number;
  currency: "₹";
  note: string;
  sources: { title: string; url: string }[];
}

const MIN_SOURCES = 2;

function parse(text: string): { low: number; high: number; note: string } | null {
  const num = (label: string) => {
    const m = text.match(new RegExp(`${label}\\s*[:=]\\s*(?:₹|rs\\.?|inr)?\\s*([\\d,]+)`, "i"));
    return m ? Number(m[1]!.replace(/,/g, "")) : NaN;
  };
  const low = num("LOW");
  const high = num("HIGH");
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high < low || high > 10_000_000) return null;
  const note = text.match(/NOTE\s*[:=]\s*(.+)/i)?.[1]?.trim() ?? "";
  return { low, high, note: note.slice(0, 240) };
}

export async function checkPrice(pageId: string, token: string | null, itemId: string): Promise<PriceCheck | null> {
  await checkToken(pageId, token);
  const db = supabaseAdmin();
  const { data: page } = await db.from("pages").select("job_id").eq("id", pageId).single();
  const { data: item } = await db.from("items").select("id, name, description, real_size_m, job_id").eq("id", itemId).maybeSingle();
  if (!page || !item || item.job_id !== page.job_id) throw new EditError(404, "product not found");

  const product = `${item.name}${item.description ? ` (${item.description})` : ""}${item.real_size_m ? `, about ${Math.round(Number(item.real_size_m) * 100)} cm` : ""}`;
  const day = new Date().toISOString().slice(0, 10);
  const key = hash("price-v3", META_MODELS.spark, product, day);

  const { value } = await cached(
    "price",
    key,
    async () => {
      const res = await paid(
        { provider: "meta", model: META_MODELS.spark, estimateUsd: 0.06, actualUsd: (r) => responsesCost("muse-spark-1.3", r.usage as ResponsesUsage, countSearches(r)), label: `price ${item.id.slice(0, 8)}` },
        () =>
          meta().responses.create({
            model: META_MODELS.spark,
            input: `A small seller in India wants to price this product for Instagram and WhatsApp customers: ${product}.
Search for what similar new products currently sell for in India, from shops or marketplaces. Ignore luxury brands unless the product is one.
Write two or three sentences on what you found, citing the shop pages you used.
Then end with exactly these three lines:
LOW: <price in rupees, digits only>
HIGH: <price in rupees, digits only>
NOTE: <one short sentence on what drives the range>`,
            tools: [{ type: "web_search", user_location: { type: "approximate", country: "IN" } }] as OpenAI.Responses.Tool[],
            include: ["web_search_call.results"],
          }),
      );
      const text = res.output_text ?? "";
      const sources = new Map<string, string>();
      for (const out of res.output) {
        if (out.type !== "message") continue;
        for (const block of out.content) {
          if (block.type !== "output_text") continue;
          for (const a of block.annotations ?? []) {
            if (a.type === "url_citation" && /^https?:\/\//.test(a.url)) sources.set(a.url, a.title || new URL(a.url).hostname);
          }
        }
      }
      // the format above leaves little room for inline citations, so fall back to the pages the search returned
      if (sources.size < MIN_SOURCES) {
        for (const out of res.output) {
          if (out.type !== "web_search_call") continue;
          const results = (out as unknown as { results?: { url?: string; title?: string }[] }).results ?? [];
          for (const r of results) if (r.url && /^https?:\/\//.test(r.url) && !sources.has(r.url)) sources.set(r.url, r.title || new URL(r.url).hostname);
        }
      }
      return { text, sources: [...sources].map(([url, title]) => ({ url, title })).slice(0, 3) };
    },
    { store: "db" },
  );

  const parsed = parse(value.text);
  log.info("price check", { item: itemId, parsed: Boolean(parsed), sources: value.sources.length });
  if (!parsed || value.sources.length < MIN_SOURCES) return null;
  return { ...parsed, currency: "₹", sources: value.sources };
}

function countSearches(r: OpenAI.Responses.Response): number {
  return r.output.filter((o) => o.type === "web_search_call").length;
}
