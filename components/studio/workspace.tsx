"use client";

// The studio workspace. One tinted frame (top bar on the paper) and the work on a white sheet:
//   Products   the list, the selected product turning in 3D at real size, its details
//   Shop page  shop details, the link to share, and the page as customers see it on a phone
//   Insights   what customers did and asked, and the Shop Manager's report with Approve
//   Reel       the same products as a video to post
// Edits save on their own a moment after typing; Publish makes the page public.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findShop, saveShop } from "@/lib/client/my-shops";
import type { JobView } from "@/lib/jobs/view";
import type { EditorPage, EditorProduct, PagePatch } from "@/lib/shop/editor";
import { InsightsTab } from "./insights-tab";
import { ProductsTab } from "./products-tab";
import { LiveDialog } from "./share";
import { ShopTab } from "./shop-tab";

export type Tab = "products" | "shop" | "insights" | "reel";
type SaveState = "saved" | "dirty" | "saving" | "error";

export async function api<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(token ? { "x-kit-edit": token } : {}), ...init.headers } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
  return body;
}

function patchOf(page: EditorPage, published?: boolean): PagePatch {
  return {
    title: page.title,
    handle: page.handle,
    slug: page.slug,
    mode: page.mode,
    whatsapp: page.whatsapp ?? "",
    affiliateTag: page.affiliateTag,
    info: page.info,
    ...(published !== undefined ? { published } : {}),
    products: page.products.map((p, n) => ({ id: p.id, name: p.name, price: p.price, description: p.description, sizeM: p.sizeM, link: p.link, offer: p.offer, arPose: p.arPose, soldOut: p.soldOut, hidden: p.hidden, order: n })),
  };
}

const TABS: { id: Tab; label: string }[] = [
  { id: "products", label: "Products" },
  { id: "shop", label: "Shop page" },
  { id: "insights", label: "Insights" },
  { id: "reel", label: "Reel" },
];

export function Workspace({ job }: { job: JobView }) {
  const [page, setPage] = useState<EditorPage | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<{ kind: "loading"; message: string } | { kind: "ready" } | { kind: "error"; message: string }>({ kind: "loading", message: "Opening your studio" });
  const [tab, setTab] = useState<Tab>("products");
  const [save, setSave] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [justLive, setJustLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<EditorPage | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const saved = findShop(job.id);
        if (saved) {
          setToken(saved.token);
          const p = await api<EditorPage>(`/api/pages/${saved.pageId}`, saved.token);
          latest.current = p;
          setPage(p);
          setState({ kind: "ready" });
          return;
        }
        const existing = await api<{ pageId?: string }>(`/api/jobs/${job.id}/page`, null);
        if (existing.pageId) {
          setState({ kind: "error", message: "This shop was set up on another device. Open it there to edit." });
          return;
        }
        setState({ kind: "loading", message: "Muse Spark is naming each product and estimating its size" });
        const created = await api<{ pageId: string; slug: string; token: string }>(`/api/jobs/${job.id}/page`, null, { method: "POST" });
        saveShop({ jobId: job.id, pageId: created.pageId, slug: created.slug, token: created.token, title: "My shop", createdAt: new Date().toISOString() });
        setToken(created.token);
        const p = await api<EditorPage>(`/api/pages/${created.pageId}`, created.token);
        latest.current = p;
        setPage(p);
        setState({ kind: "ready" });
      } catch (err) {
        setState({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong." });
      }
    })();
  }, [job.id]);

  const persist = useCallback(
    async (published?: boolean) => {
      const p = latest.current;
      if (!p || !token) return;
      setSave("saving");
      setSaveError(null);
      try {
        const next = await api<EditorPage>(`/api/pages/${p.id}`, token, { method: "PATCH", body: JSON.stringify(patchOf(p, published)) });
        // keep what the seller typed while the save was in flight; take the server's published state
        latest.current = { ...latest.current!, published: next.published, slug: next.slug };
        setPage((cur) => (cur ? { ...cur, published: next.published, slug: next.slug } : cur));
        saveShop({ jobId: job.id, pageId: next.id, slug: next.slug, token, title: next.title, createdAt: findShop(job.id)?.createdAt ?? new Date().toISOString() });
        setSave("saved");
        setPreviewKey((k) => k + 1);
      } catch (err) {
        setSave("error");
        setSaveError(err instanceof Error ? err.message : "Couldn't save.");
      }
    },
    [job.id, token],
  );

  const update = useCallback(
    (fn: (p: EditorPage) => EditorPage) => {
      setPage((cur) => {
        if (!cur) return cur;
        const next = fn(cur);
        latest.current = next;
        return next;
      });
      setSave("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void persist(), 900);
    },
    [persist],
  );

  const setProduct = useCallback((id: string, patch: Partial<EditorProduct>) => update((p) => ({ ...p, products: p.products.map((x) => (x.id === id ? { ...x, ...patch } : x)) })), [update]);
  const setShop = useCallback((patch: Partial<EditorPage>) => update((p) => ({ ...p, ...patch })), [update]);

  const reload = useCallback(async () => {
    if (!page || !token) return;
    const p = await api<EditorPage>(`/api/pages/${page.id}`, token);
    latest.current = p;
    setPage(p);
    setPreviewKey((k) => k + 1);
  }, [page, token]);

  async function publish() {
    if (timer.current) clearTimeout(timer.current);
    const wasLive = latest.current?.published ?? false;
    setPublishing(true);
    await persist(true);
    setPublishing(false);
    if (!wasLive && latest.current?.published) setJustLive(true);
  }

  const issues = useMemo(() => {
    if (!page) return [];
    const shown = page.products.filter((p) => !p.hidden);
    const out: string[] = [];
    const noPrice = shown.filter((p) => p.price === null).length;
    const noSize = shown.filter((p) => p.sizeM === null).length;
    if (noPrice) out.push(`${noPrice} ${noPrice === 1 ? "product has" : "products have"} no price`);
    if (noSize) out.push(`${noSize} ${noSize === 1 ? "product has" : "products have"} no size, so ${noSize === 1 ? "it can't" : "they can't"} be placed in a room`);
    if (page.mode === "shop" && !page.whatsapp) out.push("Add your WhatsApp number so customers can order");
    if (page.mode === "shop" && !page.info.delivery && !page.info.cod) out.push("Add delivery and cash on delivery on the Shop page tab, so buyers don't have to ask");
    return out;
  }, [page]);

  if (state.kind !== "ready" || !page || !token) {
    return (
      <main className="bg-studio relative isolate flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="bg-grid pointer-events-none fixed inset-0 -z-10" aria-hidden />
        <p className="font-display text-[44px] leading-[0.95] text-ink">{state.kind === "error" ? "Can't open this studio" : "Setting up your studio"}</p>
        <p className="max-w-md text-[17px] text-ink-muted">{state.kind === "loading" ? `${state.message}…` : state.kind === "error" ? state.message : ""}</p>
        {state.kind === "loading" && <div className="kit-breathe h-1.5 w-40 rounded-full bg-cobalt-500" />}
        {state.kind === "error" && (
          <Link href="/dashboard" className="mt-2 rounded-full bg-ink px-6 py-3 text-[15px] font-medium text-white">
            My shops
          </Link>
        )}
      </main>
    );
  }

  const saveLabel = save === "saving" ? "Saving…" : save === "dirty" ? "Unsaved changes" : save === "error" ? saveError ?? "Couldn't save" : page.published ? "All changes live" : "Saved as draft";

  return (
    <main className="flex h-svh flex-col bg-paper text-ink">
      <h1 className="sr-only">{page.title} studio</h1>
      {/* the frame: one bar on the paper, no rule under it */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4 lg:h-14 lg:flex-nowrap lg:py-0">
        <Link href="/dashboard" className="flex size-9 items-center justify-center rounded-full text-[20px] text-ink-soft transition-colors hover:bg-ink/5" aria-label="Back to My shops">
          ‹
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none">
          <input
            value={page.title}
            onChange={(e) => setShop({ title: e.target.value.slice(0, 60) })}
            size={Math.max(6, page.title.length)}
            className="font-display min-w-0 max-w-full rounded-lg bg-transparent px-1.5 py-1 text-[24px] leading-none text-ink outline-none hover:bg-ink/5 focus:bg-card focus:ring-2 focus:ring-cobalt-500 lg:max-w-[28ch]"
            aria-label="Shop name"
          />
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${page.published ? "bg-cobalt-50 text-cobalt-700" : "bg-paper-deep text-ink-soft"}`}>{page.published ? "Live" : "Draft"}</span>
        </div>

        <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto lg:order-none lg:mx-auto lg:w-auto" aria-label="Studio">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`relative shrink-0 px-3 py-2.5 text-[15px] font-medium transition-colors ${tab === t.id ? "text-ink" : "text-ink-muted hover:text-ink"}`}
            >
              {t.label}
              <span className={`absolute inset-x-1 -bottom-px h-[2px] rounded-full transition-colors ${tab === t.id ? "bg-ink" : "bg-transparent"}`} />
            </button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 lg:ml-0">
          <span className={`hidden text-[13px] md:inline ${save === "error" ? "text-destructive" : "text-ink-muted"}`} aria-live="polite">
            {saveLabel}
          </span>
          <Link
            href={page.published ? `/k/${page.slug}` : `/k/${page.slug}?preview=${encodeURIComponent(token)}`}
            target="_blank"
            className="hidden h-9 items-center rounded-full bg-paper-deep px-4 text-[14px] font-medium text-ink hover:bg-paper-shade sm:inline-flex"
          >
            {page.published ? "View page" : "Preview"}
          </Link>
          {/* a live page takes edits as they save, so once it is live the action is sharing it */}
          <button
            type="button"
            onClick={page.published ? () => setJustLive(true) : publish}
            disabled={publishing || (!page.published && save === "saving")}
            className="kit-press inline-flex h-9 items-center rounded-full bg-ink px-4 text-[14px] font-medium text-white hover:bg-ink-soft disabled:opacity-60"
          >
            {publishing ? "Publishing…" : page.published ? "Share" : "Publish"}
          </button>
        </div>
      </header>

      {justLive && <LiveDialog link={`${window.location.origin}/k/${page.slug}`} title={page.title} onClose={() => setJustLive(false)} />}

      {/* the sheet: inset from the right and bottom edges, one edge, no shadow */}
      <div className="min-h-0 flex-1 px-2 pb-2 sm:pl-2 sm:pr-2">
        <div className="h-full overflow-hidden rounded-2xl border border-paper-shade bg-card">
          {tab === "products" && <ProductsTab page={page} token={token} issues={issues} published={page.published} onProduct={setProduct} onReorder={(products) => update((p) => ({ ...p, products }))} />}
          {tab === "shop" && (
            <ShopTab
              page={page}
              token={token}
              previewKey={previewKey}
              issues={issues}
              onShop={setShop}
              onPublish={publish}
              onUnpublish={async () => {
                if (timer.current) clearTimeout(timer.current);
                await persist(false);
              }}
              publishing={publishing}
            />
          )}
          {tab === "insights" && <InsightsTab page={page} token={token} onApplied={reload} onGoShare={() => setTab("shop")} />}
          {tab === "reel" && (
            <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
              <h2 className="font-display text-[clamp(36px,4vw,56px)] leading-[0.95]">
                A Reel of <span className="italic">these products</span>
              </h2>
              <p className="max-w-[40ch] text-[16px] text-ink-soft">The same 3D products, animated into a 1080 × 1920 video you can post. Made in your browser, free.</p>
              <Link href={`/j/${job.id}/studio`} className="kit-press inline-flex h-12 items-center rounded-full bg-ink px-6 text-[16px] font-medium text-white">
                Open the Reel maker
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
