"use client";

// The seller's side on the landing page: the real studio's Products view, on the live sample shop's products.
// Visitors can pick products, turn them and type into the fields; nothing is saved anywhere.

import { useCallback, useState } from "react";
import { ProductsTab } from "@/components/studio/products-tab";
import type { EditorPage, EditorProduct } from "@/lib/shop/editor";

const TABS = ["Products", "Shop page", "Insights", "Reel"];

export function StudioDemo({ initial }: { initial: EditorPage }) {
  const [page, setPage] = useState(initial);
  const onProduct = useCallback((id: string, patch: Partial<EditorProduct>) => setPage((p) => ({ ...p, products: p.products.map((x) => (x.id === id ? { ...x, ...patch } : x)) })), []);
  const onReorder = useCallback((products: EditorProduct[]) => setPage((p) => ({ ...p, products })), []);

  return (
    <div data-ui className="flex h-[860px] flex-col overflow-hidden rounded-[28px] bg-paper text-left shadow-[0_60px_120px_-60px_rgb(40_30_20/.55)] lg:h-[720px]">
      <div className="flex shrink-0 items-center gap-3 px-4 py-2.5">
        <span className="font-display text-[22px] leading-none text-ink">{page.title}</span>
        <span className="rounded-full bg-cobalt-50 px-2.5 py-1 text-[12px] font-semibold text-cobalt-700">Live</span>
        <span className="mx-auto hidden gap-1 lg:flex">
          {TABS.map((t, i) => (
            <span key={t} className={`relative px-3 py-2 text-[14px] font-medium ${i === 0 ? "text-ink" : "text-ink-muted"}`}>
              {t}
              {i === 0 && <span className="absolute inset-x-1 -bottom-px h-[2px] rounded-full bg-ink" />}
            </span>
          ))}
        </span>
        <span className="ml-auto rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white lg:ml-0">Update</span>
      </div>
      <div className="min-h-0 flex-1 px-2 pb-2">
        <div className="h-full overflow-hidden rounded-2xl border border-paper-shade bg-card">
          <ProductsTab page={page} token="" issues={[]} published onProduct={onProduct} onReorder={onReorder} demo />
        </div>
      </div>
    </div>
  );
}
