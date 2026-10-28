"use client";

// "Your shop page": the seller checks every product (name, price, real size, description), sets the shop
// details and publishes. A live preview of the page sits beside the form on wide screens.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findShop, saveShop } from "@/lib/client/my-shops";
import type { EditorPage, EditorProduct, PagePatch } from "@/lib/shop/editor";

type Load = { kind: "loading"; message: string } | { kind: "ready" } | { kind: "error"; message: string };

const input = "w-full rounded-2xl bg-paper px-4 py-3 text-[16px] text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-cobalt-500";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="text-[13px] text-ink-muted">{hint}</span>}
    </label>
  );
}

async function api<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(token ? { "x-kit-edit": token } : {}), ...init.headers } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
  return body;
}

function ProductRow({
  product,
  mode,
  index,
  count,
  onChange,
  onMove,
}: {
  product: EditorProduct;
  mode: "shop" | "creator";
  index: number;
  count: number;
  onChange: (patch: Partial<EditorProduct>) => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const sizeCm = product.sizeM === null ? "" : String(Math.round(product.sizeM * 1000) / 10);
  return (
    <li className={`flex flex-col gap-4 rounded-3xl bg-card p-5 transition-opacity ${product.hidden ? "opacity-55" : ""}`}>
      <div className="flex items-start gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-paper-deep">
          {product.cutoutUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.cutoutUrl} alt="" className="shadow-object max-h-[78%] max-w-[78%] object-contain" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input value={product.name} onChange={(e) => onChange({ name: e.target.value.slice(0, 60) })} className={`${input} font-medium`} aria-label="Product name" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="rounded-full bg-paper px-3 py-1.5 text-[13px] font-medium text-ink-soft disabled:opacity-30" aria-label="Move up">
              Up
            </button>
            <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} className="rounded-full bg-paper px-3 py-1.5 text-[13px] font-medium text-ink-soft disabled:opacity-30" aria-label="Move down">
              Down
            </button>
            <button type="button" onClick={() => onChange({ hidden: !product.hidden })} className="ml-auto rounded-full bg-paper px-3 py-1.5 text-[13px] font-medium text-ink-soft">
              {product.hidden ? "Show on page" : "Hide"}
            </button>
          </div>
        </div>
      </div>
      {!product.hidden && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (₹)">
              <input
                inputMode="numeric"
                value={product.price ?? ""}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "");
                  onChange({ price: v ? Number(v) : null });
                }}
                placeholder="650"
                className={input}
              />
            </Field>
            <Field label="Longest side (cm)">
              <input
                inputMode="decimal"
                value={sizeCm}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d.]/g, "");
                  const cm = Number(v);
                  onChange({ sizeM: v && cm > 0 ? Math.min(999, cm) / 100 : null });
                }}
                placeholder="40"
                className={input}
              />
            </Field>
          </div>
          <p className="-mt-2 text-[13px] text-ink-muted">Kit estimated the size. Measure and correct it: it sets the real size in &quot;See it in your room&quot;.</p>
          <Field label="Description">
            <textarea value={product.description ?? ""} onChange={(e) => onChange({ description: e.target.value.slice(0, 400) || null })} rows={2} className={`${input} resize-none`} />
          </Field>
          {mode === "creator" && (
            <Field label="Buy link" hint="Your affiliate or store link for this product.">
              <input value={product.link ?? ""} onChange={(e) => onChange({ link: e.target.value.trim() || null })} placeholder="https://" className={input} />
            </Field>
          )}
        </>
      )}
    </li>
  );
}

export function ShopEditor({ jobId }: { jobId: string }) {
  const [load, setLoad] = useState<Load>({ kind: "loading", message: "Opening your shop page" });
  const [page, setPage] = useState<EditorPage | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const saved = findShop(jobId);
        if (saved) {
          setToken(saved.token);
          setPage(await api<EditorPage>(`/api/pages/${saved.pageId}`, saved.token));
          setLoad({ kind: "ready" });
          return;
        }
        const existing = await api<{ pageId?: string }>(`/api/jobs/${jobId}/page`, null);
        if (existing.pageId) {
          setLoad({ kind: "error", message: "This shop page was made on another device. Open it there to edit." });
          return;
        }
        setLoad({ kind: "loading", message: "Muse Spark is writing names, descriptions and sizes for each product" });
        const created = await api<{ pageId: string; slug: string; token: string }>(`/api/jobs/${jobId}/page`, null, { method: "POST" });
        saveShop({ jobId, pageId: created.pageId, slug: created.slug, token: created.token, title: "My shop", createdAt: new Date().toISOString() });
        setToken(created.token);
        setPage(await api<EditorPage>(`/api/pages/${created.pageId}`, created.token));
        setLoad({ kind: "ready" });
      } catch (err) {
        setLoad({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong." });
      }
    })();
  }, [jobId]);

  const set = useCallback((patch: Partial<EditorPage>) => {
    setPage((p) => (p ? { ...p, ...patch } : p));
    setSaving("idle");
  }, []);

  const setProduct = useCallback((id: string, patch: Partial<EditorProduct>) => {
    setPage((p) => (p ? { ...p, products: p.products.map((x) => (x.id === id ? { ...x, ...patch } : x)) } : p));
    setSaving("idle");
  }, []);

  const move = useCallback((index: number, dir: -1 | 1) => {
    setPage((p) => {
      if (!p) return p;
      const list = [...p.products];
      const [item] = list.splice(index, 1);
      if (!item) return p;
      list.splice(index + dir, 0, item);
      return { ...p, products: list.map((x, n) => ({ ...x, order: n })) };
    });
    setSaving("idle");
  }, []);

  async function save(publish?: boolean) {
    if (!page || !token) return;
    setSaving("saving");
    setError(null);
    const patch: PagePatch = {
      title: page.title,
      handle: page.handle,
      slug: page.slug,
      mode: page.mode,
      whatsapp: page.whatsapp ?? "",
      affiliateTag: page.affiliateTag,
      ...(publish !== undefined ? { published: publish } : {}),
      products: page.products.map((p, n) => ({ id: p.id, name: p.name, price: p.price, description: p.description, sizeM: p.sizeM, link: p.link, hidden: p.hidden, order: n })),
    };
    try {
      const next = await api<EditorPage>(`/api/pages/${page.id}`, token, { method: "PATCH", body: JSON.stringify(patch) });
      setPage(next);
      saveShop({ jobId, pageId: next.id, slug: next.slug, token, title: next.title, createdAt: findShop(jobId)?.createdAt ?? new Date().toISOString() });
      setSaving("saved");
      setPreviewKey((k) => k + 1);
    } catch (err) {
      setSaving("idle");
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  const visible = useMemo(() => page?.products.filter((p) => !p.hidden).length ?? 0, [page]);
  const missingSize = useMemo(() => page?.products.filter((p) => !p.hidden && p.sizeM === null).length ?? 0, [page]);

  if (load.kind !== "ready" || !page) {
    return (
      <div className="mx-auto flex min-h-[60svh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-[40px] leading-[0.95] text-ink">{load.kind === "error" ? "Can't open this page" : "Setting up your shop"}</p>
        <p className="text-[16px] text-ink-muted">{load.kind === "loading" ? `${load.message}…` : load.kind === "error" ? load.message : ""}</p>
        {load.kind === "loading" && <div className="kit-breathe h-1.5 w-40 rounded-full bg-cobalt-500" />}
      </div>
    );
  }

  const previewUrl = `/k/${page.slug}${page.published ? "" : `?preview=${encodeURIComponent(token ?? "")}`}`;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-5 pb-32 pt-2 sm:px-8 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-display text-title text-ink">
            Your shop <span className="italic">page</span>
          </h1>
          <p className="max-w-[44ch] text-[17px] text-ink-muted">Check each product, add prices, then publish. You get one link for your bio, WhatsApp and status.</p>
        </div>

        <section className="flex flex-col gap-4 rounded-3xl bg-card p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shop name">
              <input value={page.title} onChange={(e) => set({ title: e.target.value.slice(0, 60) })} className={`${input} font-display text-[22px]`} />
            </Field>
            <Field label="Instagram handle">
              <input value={page.handle ?? ""} onChange={(e) => set({ handle: e.target.value.replace(/\s/g, "").slice(0, 40) || null })} placeholder="@yourshop" className={input} />
            </Field>
          </div>
          <div className="flex gap-1 rounded-full bg-paper-deep p-1" role="radiogroup" aria-label="Page type">
            {(["shop", "creator"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={page.mode === m}
                onClick={() => set({ mode: m })}
                className={`flex-1 rounded-full px-3 py-2 text-[14px] font-medium transition-colors ${page.mode === m ? "bg-card text-ink shadow-[0_1px_2px_rgb(40_30_20/.12)]" : "text-ink-muted hover:text-ink"}`}
              >
                {m === "shop" ? "I sell these" : "I recommend these"}
              </button>
            ))}
          </div>
          {page.mode === "shop" ? (
            <Field label="WhatsApp number for orders" hint="With country code. Customers tap Order and WhatsApp opens with the product filled in.">
              <input value={page.whatsapp ?? ""} onChange={(e) => set({ whatsapp: e.target.value.slice(0, 20) || null })} inputMode="tel" placeholder="+91 98765 43210" className={input} />
            </Field>
          ) : (
            <p className="text-[14px] text-ink-muted">Add a buy link to each product below. Followers tap Buy and go straight to it.</p>
          )}
          <Field label="Page address">
            <div className="flex items-center rounded-2xl bg-paper pl-4 text-[16px] text-ink-muted focus-within:ring-2 focus-within:ring-cobalt-500">
              <span className="shrink-0">/k/</span>
              <input value={page.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) })} className="min-w-0 flex-1 bg-transparent py-3 pr-4 text-ink outline-none" />
            </div>
          </Field>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-center text-[15px] font-semibold text-ink-soft">
            {visible} of {page.products.length} products on the page
          </h2>
          <ul className="flex flex-col gap-3">
            {page.products.map((p, i) => (
              <ProductRow key={p.id} product={p} mode={page.mode} index={i} count={page.products.length} onChange={(patch) => setProduct(p.id, patch)} onMove={(dir) => move(i, dir)} />
            ))}
          </ul>
        </section>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-6 flex flex-col items-center gap-3">
          <div className="h-[780px] w-[380px] overflow-hidden rounded-[44px] border-[10px] border-ink bg-paper shadow-[0_40px_80px_-40px_rgb(40_30_20/.5)]">
            <iframe key={previewKey} src={previewUrl} title="Shop page preview" className="size-full" />
          </div>
          <p className="text-[13px] text-ink-faint">Preview updates when you save.</p>
        </div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-paper-shade bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-center gap-3 px-5 py-4 sm:justify-between sm:px-8">
          <p className="text-[14px] text-ink-muted">
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : page.published ? (
              <>
                Live at{" "}
                <Link href={`/k/${page.slug}`} target="_blank" className="font-medium text-cobalt-600 underline-offset-4 hover:underline">
                  /k/{page.slug}
                </Link>
              </>
            ) : missingSize ? (
              `${missingSize} ${missingSize === 1 ? "product has" : "products have"} no size yet, so they won't show in your room.`
            ) : (
              "Not published yet."
            )}
          </p>
          <div className="flex items-center gap-2">
            <Link href={`/j/${jobId}/studio`} className="rounded-full px-4 py-3 text-[15px] font-medium text-ink-muted hover:text-ink">
              Make a Reel
            </Link>
            <button type="button" onClick={() => save()} disabled={saving === "saving"} className="rounded-full bg-paper-deep px-5 py-3 text-[15px] font-medium text-ink disabled:opacity-60">
              {saving === "saving" ? "Saving" : saving === "saved" ? "Saved" : "Save"}
            </button>
            <button type="button" onClick={() => save(true)} disabled={saving === "saving"} className="kit-press rounded-full bg-cobalt-500 px-6 py-3 text-[15px] font-medium text-white hover:bg-cobalt-600 disabled:opacity-60">
              {page.published ? "Update page" : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
