"use client";

// "Ask about this product": suggested questions plus a free question, answered by the shop's assistant.
// A per-browser visitor id lets the assistant remember this customer's earlier questions.

import { useState } from "react";
import type { ShopProduct } from "@/lib/shop/shops";

interface Turn {
  question: string;
  answer: string | null;
  error?: string;
}

function visitorId(): string {
  const KEY = "kit:visitor";
  try {
    const known = localStorage.getItem(KEY);
    if (known) return known;
    const fresh = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID().replace(/-/g, "");
  }
}

function suggestions(product: ShopProduct): string[] {
  const list = [];
  if (product.sizeM !== null) list.push(product.sizeM > 0.25 ? "Will a 14-inch laptop fit?" : "Will my phone fit?");
  list.push("What is it made of?");
  list.push("What colours do you have?");
  return list;
}

export function AskBox({ slug, product, onOrderMessage }: { slug: string; product: ShopProduct; onOrderMessage: (message: string) => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const busy = turns.some((t) => t.answer === null && !t.error);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setDraft("");
    setTurns((t) => [...t, { question: q, answer: null }]);
    try {
      const res = await fetch(`/api/k/${slug}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, itemId: product.id, visitorId: visitorId() }),
      });
      const body = (await res.json()) as { answer?: string; order_message?: string; error?: string };
      if (!res.ok || !body.answer) throw new Error(body.error ?? "Couldn't answer that just now.");
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, answer: body.answer! } : x)));
      if (body.order_message) onOrderMessage(body.order_message);
    } catch (err) {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: err instanceof Error ? err.message : "Couldn't answer that." } : x)));
    }
  }

  return (
    <section className="flex w-full flex-col gap-3 text-left" aria-label="Ask about this product">
      <h3 className="text-center text-[15px] font-semibold text-ink-soft">Ask about this product</h3>
      {turns.map((t, i) => (
        <div key={i} className="flex flex-col gap-2">
          <p className="self-end rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[15px] text-white">{t.question}</p>
          <p className={`self-start rounded-2xl rounded-bl-md px-4 py-2.5 text-[15px] ${t.error ? "bg-paper text-ink-muted" : "bg-cobalt-50 text-ink"}`}>
            {t.error ?? t.answer ?? <span className="kit-breathe inline-block">Thinking…</span>}
          </p>
        </div>
      ))}
      {turns.length === 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {suggestions(product).map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} className="rounded-full bg-paper px-3.5 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:bg-paper-deep">
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex items-center gap-2 rounded-full bg-paper p-1.5 pl-4 focus-within:ring-2 focus-within:ring-cobalt-500"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 300))} placeholder="Type a question" className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-faint" aria-label="Your question" />
        <button type="submit" disabled={busy || draft.trim().length < 2} className="rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-white disabled:opacity-40">
          Ask
        </button>
      </form>
    </section>
  );
}
