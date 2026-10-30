"use client";

// My shops: every shop page this browser can edit, with its products, whether it is live, and this week's visits.
// Edit keys live in this browser only, so a shop made on another device shows up there instead.

import Link from "next/link";
import { useEffect, useState } from "react";
import { listShops, type SavedShop } from "@/lib/client/my-shops";
import type { EditorPage } from "@/lib/shop/editor";
import type { ShopMetrics } from "@/lib/shop/manager";

interface Loaded {
  shop: SavedShop;
  page: EditorPage | null;
  metrics: ShopMetrics | null;
}

async function load(shop: SavedShop): Promise<Loaded> {
  const headers = { "x-kit-edit": shop.token };
  const page = await fetch(`/api/pages/${shop.pageId}`, { headers }).then((r) => (r.ok ? (r.json() as Promise<EditorPage>) : null)).catch(() => null);
  const metrics = page?.published
    ? await fetch(`/api/pages/${shop.pageId}/report`, { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { metrics?: ShopMetrics } | null) => j?.metrics ?? null)
        .catch(() => null)
    : null;
  return { shop, page, metrics };
}

function ShopRow({ item }: { item: Loaded }) {
  const { shop, page, metrics } = item;
  const products = page?.products.filter((p) => !p.hidden) ?? [];
  const orders = metrics?.products.reduce((s, p) => s + p.orders, 0) ?? 0;
  return (
    <li className="flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-paper-shade sm:flex-row sm:items-center sm:gap-6">
      <div className="flex shrink-0 -space-x-3">
        {products.slice(0, 4).map((p) => (
          <span key={p.id} className="flex size-14 items-center justify-center rounded-2xl bg-paper-deep ring-2 ring-card">
            {p.cutoutUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.cutoutUrl} alt="" className="max-h-[78%] max-w-[78%] object-contain" />
            )}
          </span>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-display truncate text-[30px] leading-none text-ink">{page?.title ?? shop.title}</span>
          {page && <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${page.published ? "bg-cobalt-50 text-cobalt-700" : "bg-paper-deep text-ink-soft"}`}>{page.published ? "Live" : "Draft"}</span>}
        </div>
        <span className="text-[14px] tabular-nums text-ink-muted">
          {page ? `${products.length} products` : "Loading…"}
          {metrics ? ` · ${metrics.pageViews} ${metrics.pageViews === 1 ? "visit" : "visits"} and ${orders} order ${orders === 1 ? "tap" : "taps"} this week` : page?.published === false ? " · not published yet" : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {page?.published && (
          <Link href={`/k/${page.slug}`} target="_blank" className="rounded-full bg-paper-deep px-4 py-2.5 text-[15px] font-medium text-ink hover:bg-paper-shade">
            View page
          </Link>
        )}
        <Link href={`/studio/${shop.jobId}`} className="kit-press rounded-full bg-ink px-5 py-2.5 text-[15px] font-medium text-white">
          Open studio
        </Link>
      </div>
    </li>
  );
}

export function ShopsList() {
  const [items, setItems] = useState<Loaded[] | null>(null);

  useEffect(() => {
    const shops = listShops();
    setItems(shops.map((shop) => ({ shop, page: null, metrics: null })));
    shops.forEach((shop, i) =>
      load(shop).then((loaded) => setItems((cur) => (cur ? cur.map((x, n) => (n === i ? loaded : x)) : cur))),
    );
  }, []);

  if (items === null) return null;
  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <p className="max-w-[36ch] text-lead text-ink-muted">No shops on this device yet. One photo of your products is all it takes.</p>
        <Link href="/new?mode=shop" className="kit-press rounded-full bg-cobalt-500 px-7 py-4 text-[17px] font-medium text-white hover:bg-cobalt-600">
          Make your shop link
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <ShopRow key={item.shop.pageId} item={item} />
        ))}
      </ul>
      <div className="flex flex-col items-center gap-3 text-center">
        <Link href="/new?mode=shop" className="kit-press rounded-full bg-cobalt-500 px-7 py-3.5 text-[16px] font-medium text-white hover:bg-cobalt-600">
          Make another shop
        </Link>
        <p className="text-[14px] text-ink-muted">
          Shops are kept on this device.{" "}
          <Link href="/reels" className="font-medium text-cobalt-700 underline-offset-4 hover:underline">
            My Reels
          </Link>
        </p>
      </div>
    </div>
  );
}
