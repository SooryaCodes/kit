// The Shop Manager: a Muse Wonder agent that reads the shop's own numbers (views, 3D and AR opens, questions,
// WhatsApp taps per product) and what customers asked, writes the seller a short morning report, and proposes
// concrete changes. Nothing changes on the page until the seller taps Approve; every proposal and decision is logged.

import "server-only";
import type OpenAI from "openai";
import { z } from "zod";
import { paid } from "../budget";
import { round, tokenCost, type TokenUsage } from "../cost";
import type { Json } from "../database.types";
import { createLogger, errorMessage } from "../log";
import { META_MODELS, meta } from "../meta";
import { supabaseAdmin } from "../supabase/server";
import { checkToken, EditError } from "./editor";
import { makeSizePicture } from "./images";

const log = createLogger("shop:manager");

const MAX_STEPS = 8;
const REPORTS_PER_DAY = 6;

export type ActionKind = "update_description" | "set_offer" | "add_size_image";

export interface ProductMetrics {
  itemId: string;
  name: string;
  views: number;
  open3d: number;
  openAr: number;
  questions: number;
  orders: number;
}

export interface ShopMetrics {
  days: number;
  pageViews: number;
  products: ProductMetrics[];
}

export interface AgentAction {
  id: string;
  kind: ActionKind;
  itemId: string | null;
  itemName: string | null;
  payload: Record<string, unknown>;
  reason: string;
  status: "proposed" | "applied" | "dismissed" | "failed";
  createdAt: string;
}

export interface Report {
  id: string;
  summary: string;
  metrics: ShopMetrics;
  costUsd: number;
  createdAt: string;
  actions: AgentAction[];
}

const INSTRUCTIONS = `You are the Shop Manager for a small seller who sells on Instagram and WhatsApp. Their shop page shows each product in 3D, lets customers place it in their room at real size, answers questions, and takes orders on WhatsApp.
Every morning you read the numbers and the questions customers asked, then write the seller a short report and propose changes.
Work like this:
1. Call get_shop, get_metrics and get_questions.
2. Look for what is stopping sales: products many people open but nobody orders, the same question asked again and again, missing sizes, descriptions that leave out what customers ask about.
3. Propose at most 3 actions with propose_action, each tied to evidence in the numbers or questions:
   - update_description: rewrite one product's description to answer what customers keep asking. Only use facts the seller already gave (name, size, description) or that customers' questions reveal they need; never invent materials or features. If the fact customers need is missing, say in the report that the seller should add it instead of proposing a rewrite.
   - add_size_image: add a picture of the product next to an everyday object at true scale, when customers ask about size or fit. Only for products with a measured size.
   - set_offer: a small badge such as "₹50 off", only when a product gets lots of attention but no orders. Keep it modest and say it is the seller's call.
4. Finish with the report itself: 3 to 5 short lines in plain English, numbers first, then what you proposed and why. No headings, no bullet symbols, no emoji. If there is little activity yet, say so plainly and propose nothing.`;

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  { type: "function", function: { name: "get_shop", description: "The shop's products: id, name, price, measured size, description, current offer, whether a size picture exists.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  {
    type: "function",
    function: {
      name: "get_metrics",
      description: "Counts per product over the last N days: page views, 3D opens, AR (see it in your room) opens, questions asked, WhatsApp order taps.",
      parameters: { type: "object", properties: { days: { type: "integer", minimum: 1, maximum: 30 } }, required: ["days"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_questions",
      description: "The most recent customer questions and the answers they got, with the product each was about.",
      parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 50 } }, required: ["limit"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_action",
      description: "Propose one change for the seller to approve. Nothing changes until they approve it.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["update_description", "set_offer", "add_size_image"] },
          item_id: { type: "string" },
          description: { type: "string", description: "update_description only: the new description, at most 40 words" },
          offer: { type: "string", description: "set_offer only: the badge text, at most 30 characters" },
          reason: { type: "string", description: "one sentence the seller will read, citing the evidence" },
        },
        required: ["kind", "item_id", "reason"],
        additionalProperties: false,
      },
    },
  },
];

async function pageJob(pageId: string): Promise<string> {
  const { data } = await supabaseAdmin().from("pages").select("job_id").eq("id", pageId).single();
  if (!data) throw new EditError(404, "page not found");
  return data.job_id;
}

async function shopFacts(jobId: string) {
  const { data } = await supabaseAdmin()
    .from("items")
    .select("id, name, price, currency, real_size_m, description, offer_label, size_image_path")
    .eq("job_id", jobId)
    .eq("status", "ready")
    .eq("hidden", false)
    .order("display_order", { ascending: true, nullsFirst: false });
  return (data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    price: i.price === null ? null : `${i.currency ?? "₹"}${Number(i.price)}`,
    size_cm: i.real_size_m === null ? null : Math.round(Number(i.real_size_m) * 1000) / 10,
    description: i.description,
    offer: i.offer_label,
    has_size_picture: Boolean(i.size_image_path),
  }));
}

export async function shopMetrics(pageId: string, days = 7): Promise<ShopMetrics> {
  const db = supabaseAdmin();
  const jobId = await pageJob(pageId);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: events }, { data: items }] = await Promise.all([
    db.from("events").select("type, item_id").eq("page_id", pageId).gte("created_at", since).limit(20000),
    db.from("items").select("id, name").eq("job_id", jobId).eq("status", "ready").eq("hidden", false).order("display_order", { ascending: true, nullsFirst: false }),
  ]);
  const by = new Map<string, ProductMetrics>((items ?? []).map((i) => [i.id, { itemId: i.id, name: i.name, views: 0, open3d: 0, openAr: 0, questions: 0, orders: 0 }]));
  let pageViews = 0;
  for (const e of events ?? []) {
    if (e.type === "view") pageViews++;
    const m = e.item_id ? by.get(e.item_id) : undefined;
    if (!m) continue;
    if (e.type === "open_3d") {
      m.open3d++;
      m.views++;
    } else if (e.type === "open_ar") m.openAr++;
    else if (e.type === "ask") m.questions++;
    else if (e.type === "buy") m.orders++;
  }
  return { days, pageViews, products: [...by.values()] };
}

export async function recentQuestions(pageId: string, limit: number) {
  const { data } = await supabaseAdmin()
    .from("conversations")
    .select("question, answer, created_at, items(name)")
    .eq("page_id", pageId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((c) => ({ product: (c.items as { name?: string } | null)?.name ?? "the shop", question: c.question, answer: c.answer, at: c.created_at }));
}

const Proposal = z.object({
  kind: z.enum(["update_description", "set_offer", "add_size_image"]),
  item_id: z.string().uuid(),
  description: z.string().max(400).optional(),
  offer: z.string().max(40).optional(),
  reason: z.string().min(1).max(400),
});

export async function runMorningReport(pageId: string, token: string | null): Promise<Report> {
  await checkToken(pageId, token);
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db.from("agent_reports").select("id", { count: "exact", head: true }).eq("page_id", pageId).gte("created_at", since);
  if ((count ?? 0) >= REPORTS_PER_DAY) throw new EditError(429, "You've had several reports today. The next one is ready tomorrow.");

  const jobId = await pageJob(pageId);
  const facts = await shopFacts(jobId);
  const known = new Set(facts.map((f) => f.id));
  const metrics = await shopMetrics(pageId, 7);
  const proposals: z.infer<typeof Proposal>[] = [];
  let usd = 0;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: INSTRUCTIONS },
    { role: "user", content: "Write today's report." },
  ];
  let summary = "";
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await paid(
      { provider: "meta", model: META_MODELS.wonder, estimateUsd: 0.06, actualUsd: (r) => tokenCost("muse-wonder-1.0", r.usage as TokenUsage), label: `report ${pageId.slice(0, 8)} #${step + 1}` },
      () => meta().chat.completions.create({ model: META_MODELS.wonder, reasoning_effort: "low", messages, tools: TOOLS, max_tokens: 2000 }),
    );
    usd += tokenCost("muse-wonder-1.0", res.usage as TokenUsage);
    const msg = res.choices[0]?.message;
    if (!msg) break;
    messages.push(msg);
    const calls = msg.tool_calls?.filter((c) => c.type === "function") ?? [];
    if (!calls.length) {
      summary = (msg.content ?? "").trim();
      break;
    }
    for (const call of calls) {
      if (call.type !== "function") continue;
      let result: unknown;
      try {
        const args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        if (call.function.name === "get_shop") result = facts;
        else if (call.function.name === "get_metrics") result = await shopMetrics(pageId, Math.min(30, Math.max(1, Number(args.days) || 7)));
        else if (call.function.name === "get_questions") result = await recentQuestions(pageId, Math.min(50, Math.max(1, Number(args.limit) || 20)));
        else if (call.function.name === "propose_action") {
          const p = Proposal.parse(args);
          if (!known.has(p.item_id)) throw new Error("unknown item_id; use an id from get_shop");
          if (proposals.length >= 3) throw new Error("you already proposed 3 actions");
          proposals.push(p);
          result = { ok: true, note: "Recorded. The seller will approve or dismiss it." };
        } else result = { error: "unknown tool" };
      } catch (err) {
        result = { error: errorMessage(err) };
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  if (!summary) summary = "I couldn't finish today's report. Please try again in a little while.";

  const { data: report, error } = await db
    .from("agent_reports")
    .insert({ page_id: pageId, summary, metrics: metrics as unknown as Json, cost_usd: round(usd) })
    .select("id, created_at")
    .single();
  if (error || !report) throw new Error(`could not save report: ${error?.message}`);
  if (proposals.length) {
    await db.from("agent_actions").insert(
      proposals.map((p) => ({
        page_id: pageId,
        report_id: report.id,
        kind: p.kind,
        item_id: p.item_id,
        payload: (p.kind === "update_description" ? { description: p.description ?? "" } : p.kind === "set_offer" ? { offer: p.offer ?? "" } : {}) as Json,
        reason: p.reason,
      })),
    );
  }
  log.info("report written", { page: pageId, actions: proposals.length, usd: round(usd) });
  return latestReport(pageId, token) as Promise<Report>;
}

export async function latestReport(pageId: string, token: string | null): Promise<Report | null> {
  await checkToken(pageId, token);
  const db = supabaseAdmin();
  const { data: report } = await db.from("agent_reports").select("*").eq("page_id", pageId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!report) return null;
  const { data: actions } = await db.from("agent_actions").select("*, items(name)").eq("report_id", report.id).order("created_at");
  return {
    id: report.id,
    summary: report.summary,
    metrics: report.metrics as unknown as ShopMetrics,
    costUsd: Number(report.cost_usd),
    createdAt: report.created_at,
    actions: (actions ?? []).map((a) => ({
      id: a.id,
      kind: a.kind as ActionKind,
      itemId: a.item_id,
      itemName: (a.items as { name?: string } | null)?.name ?? null,
      payload: (a.payload ?? {}) as Record<string, unknown>,
      reason: a.reason,
      status: a.status as AgentAction["status"],
      createdAt: a.created_at,
    })),
  };
}

/** The seller's decision on one proposal. Approve applies it to the page; both are logged with the time. */
export async function decideAction(pageId: string, token: string | null, actionId: string, decision: "approve" | "dismiss"): Promise<AgentAction["status"]> {
  await checkToken(pageId, token);
  const db = supabaseAdmin();
  const { data: action } = await db.from("agent_actions").select("*").eq("id", actionId).eq("page_id", pageId).maybeSingle();
  if (!action) throw new EditError(404, "suggestion not found");
  if (action.status !== "proposed") return action.status as AgentAction["status"];

  if (decision === "dismiss") {
    await db.from("agent_actions").update({ status: "dismissed", decided_at: new Date().toISOString() }).eq("id", actionId);
    return "dismissed";
  }
  const payload = (action.payload ?? {}) as { description?: string; offer?: string };
  let status: AgentAction["status"] = "applied";
  try {
    if (action.kind === "update_description" && payload.description) {
      await db.from("items").update({ description: payload.description.slice(0, 400) }).eq("id", action.item_id!);
    } else if (action.kind === "set_offer" && payload.offer) {
      await db.from("items").update({ offer_label: payload.offer.slice(0, 40) }).eq("id", action.item_id!);
    } else if (action.kind === "add_size_image") {
      const { data: item } = await db.from("items").select("id, crop_path, real_size_m").eq("id", action.item_id!).single();
      if (!item) throw new Error("product not found");
      const path = await makeSizePicture(pageId, { ...item, real_size_m: item.real_size_m === null ? null : Number(item.real_size_m) });
      await db.from("items").update({ size_image_path: path }).eq("id", item.id);
    } else throw new Error("nothing to apply");
  } catch (err) {
    log.error("action failed", { action: actionId, error: errorMessage(err) });
    status = "failed";
  }
  await db.from("agent_actions").update({ status, decided_at: new Date().toISOString() }).eq("id", actionId);
  log.info("action decided", { page: pageId, action: actionId, kind: action.kind, status });
  return status;
}
