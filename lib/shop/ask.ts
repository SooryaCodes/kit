// "Ask about this product": the shop's Muse Wonder assistant answers a customer from the seller's own facts
// (confirmed sizes, prices, descriptions) and nothing else. It remembers each visitor's earlier questions,
// says so when it can't know, and drafts the WhatsApp order message when the customer sounds ready.

import "server-only";
import { z } from "zod";
import { paid } from "../budget";
import { tokenCost, type TokenUsage } from "../cost";
import { createLogger } from "../log";
import { META_MODELS, meta } from "../meta";
import { supabaseAdmin } from "../supabase/server";

const log = createLogger("shop:ask");

/** Daily limits keep a busy or abused page from spending much: Wonder costs about 2 cents a question. */
const PER_PAGE_PER_DAY = 80;
const PER_VISITOR_PER_DAY = 15;

export class AskLimitError extends Error {}

const INSTRUCTIONS = `You are the shop assistant on a small seller's product page. Customers ask about products before ordering on WhatsApp.
Rules:
- Answer only from the shop facts given. Sizes are the product's longest side as measured by the seller. Never invent materials, colours, stock, delivery times or discounts. Delivery, cash on delivery and returns are in the shop facts when the seller set them; if a product is sold out, say so.
- If the facts don't answer the question, say you're not sure and suggest asking the seller on WhatsApp. Set "sure" to false.
- For "will it fit" questions, compare with the reference sizes below and show the arithmetic briefly (for example "about 32 cm vs 24 cm"). If one measurement can't settle it (a bag's inside depth, say), say so.
- Two or three short sentences. Friendly, plain English. Use the shop's currency.
- If the customer sounds ready to buy, write "order_message": a one-line WhatsApp message from the customer to the seller naming the product and price. Otherwise "order_message" is "".
Reference sizes (longest side unless noted): phone about 15 cm; A4 sheet 29.7 x 21 cm; 13-inch laptop about 30 cm wide; 14-inch laptop about 32 cm wide; 15.6-inch laptop about 36 cm wide; 1-litre water bottle about 25 cm tall; standard book about 23 cm.`;

const Answer = z.object({ answer: z.string().min(1).max(600), sure: z.boolean(), order_message: z.string().max(300) });
export type AskAnswer = z.infer<typeof Answer>;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "sure", "order_message"],
  properties: { answer: { type: "string" }, sure: { type: "boolean" }, order_message: { type: "string" } },
} as const;

function startOfDay(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function askShop(input: { slug: string; question: string; itemId: string | null; visitorId: string }): Promise<AskAnswer & { remaining: number }> {
  const db = supabaseAdmin();
  const { data: page } = await db.from("pages").select("id, job_id, title, published, about, city, delivery_note, returns_note, cod").eq("slug", input.slug).maybeSingle();
  if (!page?.published) throw new Error("page not found");

  const since = startOfDay();
  const [{ count: pageCount }, { count: visitorCount }] = await Promise.all([
    db.from("conversations").select("id", { count: "exact", head: true }).eq("page_id", page.id).gte("created_at", since),
    db.from("conversations").select("id", { count: "exact", head: true }).eq("page_id", page.id).eq("visitor_id", input.visitorId).gte("created_at", since),
  ]);
  if ((pageCount ?? 0) >= PER_PAGE_PER_DAY || (visitorCount ?? 0) >= PER_VISITOR_PER_DAY) {
    throw new AskLimitError("The assistant has answered a lot of questions today. Please ask the seller on WhatsApp.");
  }

  const { data: items } = await db
    .from("items")
    .select("id, name, price, currency, description, real_size_m, offer_label, sold_out")
    .eq("job_id", page.job_id)
    .eq("status", "ready")
    .eq("hidden", false)
    .order("display_order", { ascending: true, nullsFirst: false });
  const products = (items ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    price: i.price === null ? "not listed" : `${i.currency ?? "₹"}${Number(i.price)}`,
    longest_side_cm: i.real_size_m === null ? "not measured" : Math.round(Number(i.real_size_m) * 1000) / 10,
    description: i.description ?? "",
    offer: i.offer_label ?? "",
    sold_out: i.sold_out,
  }));
  const focus = products.find((p) => p.id === input.itemId);

  const { data: history } = await db
    .from("conversations")
    .select("question, answer")
    .eq("page_id", page.id)
    .eq("visitor_id", input.visitorId)
    .order("created_at", { ascending: false })
    .limit(6);

  const facts = JSON.stringify({
    shop: page.title,
    about: page.about ?? "",
    city: page.city ?? "not given",
    delivery: page.delivery_note ?? "not given",
    cash_on_delivery: page.cod ? "yes" : "not offered",
    returns: page.returns_note ?? "not given",
    products: products.map((p) => ({ name: p.name, price: p.price, longest_side_cm: p.longest_side_cm, description: p.description, offer: p.offer, sold_out: p.sold_out })),
  });
  const messages = [
    { role: "system" as const, content: INSTRUCTIONS },
    { role: "user" as const, content: `Shop facts: ${facts}` },
    ...(history ?? []).reverse().flatMap((h) => [
      { role: "user" as const, content: h.question },
      { role: "assistant" as const, content: JSON.stringify({ answer: h.answer }) },
    ]),
    { role: "user" as const, content: focus ? `About "${focus.name}": ${input.question}` : input.question },
  ];

  const res = await paid(
    { provider: "meta", model: META_MODELS.wonder, estimateUsd: 0.03, actualUsd: (r) => tokenCost("muse-wonder-1.0", r.usage as TokenUsage), label: `ask ${input.slug}` },
    () =>
      meta().chat.completions.create({
        model: META_MODELS.wonder,
        reasoning_effort: "low",
        messages,
        response_format: { type: "json_schema", json_schema: { name: "ShopAnswer", schema: SCHEMA } },
        max_tokens: 1200,
      }),
  );
  const parsed = Answer.parse(JSON.parse(res.choices[0]?.message?.content ?? "{}"));

  await db.from("conversations").insert({ page_id: page.id, visitor_id: input.visitorId, item_id: focus?.id ?? null, question: input.question, answer: parsed.answer });
  await db.from("events").insert({ page_id: page.id, item_id: focus?.id ?? null, type: "ask" });
  log.info("answered", { page: page.id, sure: parsed.sure, usd: tokenCost("muse-wonder-1.0", res.usage as TokenUsage) });
  return { ...parsed, remaining: Math.max(0, PER_VISITOR_PER_DAY - (visitorCount ?? 0) - 1) };
}
