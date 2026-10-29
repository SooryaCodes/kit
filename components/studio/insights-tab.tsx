"use client";

// Insights: this week's numbers per product, what customers asked, and the Shop Manager's report.
// Zeros print as zeros; a draft page says plainly that nothing is counted until it is published.

import { useEffect, useMemo, useState } from "react";
import { ShopManager } from "@/components/shop/shop-manager";
import type { EditorPage } from "@/lib/shop/editor";
import type { ShopMetrics } from "@/lib/shop/manager";
import { api } from "./workspace";

interface Question {
  product: string;
  question: string;
  answer: string;
  at: string;
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-display text-[44px] leading-none tabular-nums text-ink">{value}</span>
      <span className="mt-1 text-[13px] text-ink-muted">{label}</span>
    </div>
  );
}

export function InsightsTab({ page, token, onApplied, onGoShare }: { page: EditorPage; token: string; onApplied: () => void; onGoShare: () => void }) {
  const [metrics, setMetrics] = useState<ShopMetrics | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ metrics: ShopMetrics; questions: Question[] }>(`/api/pages/${page.id}/report`, token)
      .then((r) => {
        setMetrics(r.metrics);
        setQuestions(r.questions ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your numbers."));
  }, [page.id, token]);

  const thumbs = useMemo(() => new Map(page.products.map((p) => [p.id, p.cutoutUrl])), [page.products]);
  const totals = useMemo(
    () => metrics?.products.reduce((t, p) => ({ open3d: t.open3d + p.open3d, ar: t.ar + p.openAr, asks: t.asks + p.questions, orders: t.orders + p.orders }), { open3d: 0, ar: 0, asks: 0, orders: 0 }),
    [metrics],
  );
  const finding = useMemo(() => {
    if (!metrics || !totals) return null;
    if (!page.published) return "Your page is a draft. Visits are counted once it's published.";
    if (metrics.pageViews === 0) return "No visits yet this week. Share your link to start.";
    const top = [...metrics.products].sort((a, b) => b.open3d - a.open3d)[0];
    if (top && top.open3d > 0 && top.orders === 0) return `${top.name} was opened ${top.open3d} ${top.open3d === 1 ? "time" : "times"} this week with no orders yet.`;
    return `${metrics.pageViews} ${metrics.pageViews === 1 ? "visit" : "visits"} and ${totals.orders} order ${totals.orders === 1 ? "tap" : "taps"} in the last 7 days.`;
  }, [metrics, totals, page.published]);

  return (
    <div className="grid h-full overflow-y-auto lg:grid-cols-[minmax(0,1fr)_440px] lg:overflow-hidden">
      <div className="flex flex-col gap-8 px-5 py-6 lg:overflow-y-auto">
        <div>
          <h1 className="text-[16px] font-semibold text-ink">The last 7 days</h1>
          <p className="mt-1 text-[15px] text-ink">{error ?? finding ?? "Loading…"}</p>
          {!page.published && (
            <button type="button" onClick={onGoShare} className="mt-2 text-[14px] font-medium text-cobalt-700">
              Publish and share your link
            </button>
          )}
        </div>

        {metrics && totals && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-5">
            <Figure value={metrics.pageViews} label="Visits" />
            <Figure value={totals.open3d} label="Opened in 3D" />
            <Figure value={totals.ar} label="Placed in a room" />
            <Figure value={totals.asks} label="Questions" />
            <Figure value={totals.orders} label="Order taps" />
          </div>
        )}

        {metrics && (
          <section aria-labelledby="per-product">
            <h2 id="per-product" className="mb-2 text-[16px] font-semibold text-ink">
              By product
            </h2>
            <table className="w-full text-[14px]">
              <thead>
                <tr className="text-left text-[13px] text-ink-muted">
                  <th className="py-2 font-medium">Product</th>
                  <th className="py-2 text-right font-medium">3D</th>
                  <th className="py-2 text-right font-medium">In room</th>
                  <th className="hidden py-2 text-right font-medium sm:table-cell">Questions</th>
                  <th className="py-2 text-right font-medium">Orders</th>
                </tr>
              </thead>
              <tbody>
                {metrics.products.map((p) => (
                  <tr key={p.itemId} className="border-t border-paper-deep">
                    <td className="py-2">
                      <span className="flex items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-paper-deep">
                          {thumbs.get(p.itemId) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumbs.get(p.itemId)!} alt="" className="max-h-[80%] max-w-[80%] object-contain" />
                          )}
                        </span>
                        <span className="truncate text-ink">{p.name}</span>
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{p.open3d}</td>
                    <td className="py-2 text-right tabular-nums">{p.openAr}</td>
                    <td className="hidden py-2 text-right tabular-nums sm:table-cell">{p.questions}</td>
                    <td className={`py-2 text-right tabular-nums ${p.orders ? "font-semibold text-cobalt-700" : ""}`}>{p.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section aria-labelledby="asked">
          <h2 id="asked" className="mb-2 text-[16px] font-semibold text-ink">
            What customers asked
          </h2>
          {questions.length === 0 ? (
            <p className="text-[14px] text-ink-muted">No questions yet. They appear here as customers ask, with the answer they got.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {questions.map((q, i) => (
                <li key={i} className="rounded-xl bg-paper px-4 py-3">
                  <p className="text-[13px] text-ink-muted">{q.product}</p>
                  <p className="text-[15px] font-medium text-ink">{q.question}</p>
                  <p className="mt-1 text-[14px] text-ink-soft">{q.answer}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="px-3 py-3 lg:overflow-y-auto lg:border-l lg:border-paper-deep" aria-label="Shop Manager">
        {page.published ? (
          <ShopManager pageId={page.id} token={token} onApplied={onApplied} showStats={false} />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-paper px-6 py-10 text-center">
            <p className="font-display text-[34px] leading-none">
              Shop <span className="italic">Manager</span>
            </p>
            <p className="max-w-[34ch] text-[15px] text-ink-muted">Once your page is live, it reads what customers did and asked each morning and suggests changes for you to approve.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
