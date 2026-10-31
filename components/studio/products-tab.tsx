"use client";

// Products: the list on the left, the selected product turning in 3D at the centre with its real size against an
// everyday object, and its details on the right. On a phone the list becomes a strip of thumbnails above the stage.

import { useEffect, useMemo, useState } from "react";
import { ProductModel } from "@/components/shop/product-model";
import type { EditorPage, EditorProduct } from "@/lib/shop/editor";
import { formatPrice, formatSize, referenceFor } from "@/lib/shop/links";
import type { PriceCheck } from "@/lib/shop/price";
import { QrCode } from "./share";
import { api } from "./workspace";

const field = "w-full rounded-xl bg-paper px-3.5 py-2.5 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:bg-card focus:ring-2 focus:ring-cobalt-500";

function needs(p: EditorProduct): string | null {
  if (p.hidden) return "Not on the page";
  if (p.soldOut) return "Sold out";
  if (p.price === null && p.sizeM === null) return "Needs a price and size";
  if (p.price === null) return "Needs a price";
  if (p.sizeM === null) return "Needs a size";
  return null;
}

function Row({ p, selected, onSelect }: { p: EditorProduct; selected: boolean; onSelect: () => void }) {
  const note = needs(p);
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${selected ? "bg-paper" : "hover:bg-paper/60"} ${p.hidden ? "opacity-50" : ""}`}
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-paper-deep">
          {p.cutoutUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.cutoutUrl} alt="" className="max-h-[80%] max-w-[80%] object-contain" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-medium text-ink">{p.name}</span>
          <span className={`truncate text-[13px] ${note && !p.hidden ? "text-cobalt-700" : "text-ink-muted"}`}>
            {note ?? `${formatPrice(p.price!, "₹")} · ${formatSize(p.sizeM!)}`}
          </span>
        </span>
      </button>
    </li>
  );
}

/** The product against an everyday object, both bars to the same scale. */
function RealSize({ p }: { p: EditorProduct }) {
  if (p.sizeM === null) {
    return <p className="text-center text-[14px] text-ink-muted">Add the longest side in centimetres to show it at real size.</p>;
  }
  const ref = referenceFor(p.sizeM);
  const refCm = Math.max(ref.widthCm, ref.heightCm);
  const cm = p.sizeM * 100;
  const max = Math.max(cm, refCm);
  const bars = [
    { label: p.name, cm, tone: "bg-cobalt-500" },
    { label: ref.label.replace(/^an? /, ""), cm: refCm, tone: "bg-ink/25" },
  ];
  return (
    <figure className="mx-auto flex w-full max-w-[520px] flex-col gap-2.5">
      {bars.map((b) => (
        <div key={b.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[13px]">
          <span className="truncate text-ink-soft">{b.label}</span>
          <span className="h-2.5 rounded-full bg-paper-deep">
            <span className={`block h-full rounded-full ${b.tone}`} style={{ width: `${(b.cm / max) * 100}%` }} />
          </span>
          <span className="w-14 text-right tabular-nums text-ink">{Math.round(b.cm * 10) / 10} cm</span>
        </div>
      ))}
      <figcaption className="text-center text-[13px] text-ink-muted">Longest side, to scale. Customers see it at this size in their room.</figcaption>
    </figure>
  );
}

/** A QR code that opens this product on the seller's phone, ready for "See it in your room". */
function TryInRoom({ slug, productId }: { slug: string; productId: string }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const [phone, setPhone] = useState(false);
  useEffect(() => setPhone(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)), []);
  if (!origin) return null;
  const url = `${origin}/k/${slug}?p=${productId}`;
  // on a phone a QR code is no use: open the product, where See it in your room is one tap away
  if (phone) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="kit-press mx-auto flex h-11 items-center rounded-full bg-ink px-5 text-[15px] font-medium text-white">
        Try it in your room
      </a>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-[520px] items-center gap-4 rounded-2xl bg-card/90 p-3">
      <QrCode url={url} size={84} />
      <p className="text-[14px] leading-[1.45] text-ink-soft">Try it yourself: scan with your phone and tap See it in your room.</p>
    </div>
  );
}

function Inspector({ p, mode, pageId, token, demo, onChange }: { p: EditorProduct; mode: EditorPage["mode"]; pageId: string; token: string; demo?: boolean; onChange: (patch: Partial<EditorProduct>) => void }) {
  const [price, setPrice] = useState<{ state: "idle" | "checking" | "none" | "error"; check?: PriceCheck; message?: string }>({ state: "idle" });
  useEffect(() => setPrice({ state: "idle" }), [p.id]);
  const sizeCm = p.sizeM === null ? "" : String(Math.round(p.sizeM * 1000) / 10);

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-soft">Name</span>
        <input value={p.name} onChange={(e) => onChange({ name: e.target.value.slice(0, 60) })} className={`${field} font-medium`} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-soft">Price (₹)</span>
          <input
            inputMode="numeric"
            value={p.price ?? ""}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, "");
              onChange({ price: v ? Number(v) : null });
            }}
            placeholder="650"
            className={`${field} tabular-nums`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-soft">Longest side (cm)</span>
          <input
            inputMode="decimal"
            value={sizeCm}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.]/g, "");
              const n = Number(v);
              onChange({ sizeM: v && n > 0 ? Math.min(999, n) / 100 : null });
            }}
            placeholder="30"
            className={`${field} tabular-nums`}
          />
        </label>
      </div>
      <p className="-mt-3 text-[13px] text-ink-muted">Muse Spark estimated the size from the photo. Measure it once: it sets the real size customers see.</p>

      <div className={`flex flex-col gap-2 rounded-xl bg-paper px-3.5 py-3 ${demo ? "hidden" : ""}`}>
        {price.check ? (
          <>
            <p className="text-[14px] text-ink">
              Similar products sell for <span className="font-semibold tabular-nums">₹{price.check.low.toLocaleString("en-IN")} to ₹{price.check.high.toLocaleString("en-IN")}</span> online.
            </p>
            <ul className="flex flex-col gap-1">
              {price.check.sources.map((s) => (
                <li key={s.url} className="truncate text-[13px]">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-cobalt-700 underline underline-offset-4">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <button
            type="button"
            disabled={price.state === "checking"}
            onClick={async () => {
              setPrice({ state: "checking" });
              try {
                const { check } = await api<{ check: PriceCheck | null }>(`/api/pages/${pageId}/price`, token, { method: "POST", body: JSON.stringify({ itemId: p.id }) });
                setPrice(check ? { state: "idle", check } : { state: "none" });
              } catch (err) {
                setPrice({ state: "error", message: err instanceof Error ? err.message : "Couldn't check prices." });
              }
            }}
            className="self-start text-[14px] font-medium text-cobalt-700 disabled:opacity-60"
          >
            {price.state === "checking" ? "Searching shops online…" : "Check prices online"}
          </button>
        )}
        {price.state === "none" && <p className="text-[13px] text-ink-muted">Not enough real listings to suggest a range. Price it your way.</p>}
        {price.state === "error" && <p className="text-[13px] text-ink-muted">{price.message}</p>}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-soft">Description</span>
        <textarea value={p.description ?? ""} onChange={(e) => onChange({ description: e.target.value.slice(0, 400) || null })} rows={3} className={`${field} resize-none leading-relaxed`} />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-soft">In a customer&apos;s room it</span>
        <div className="flex gap-1 rounded-full bg-paper-deep p-1" role="radiogroup" aria-label="Pose in the room">
          {(["upright", "flat"] as const).map((pose) => (
            <button
              key={pose}
              type="button"
              role="radio"
              aria-checked={p.arPose === pose}
              onClick={() => onChange({ arPose: pose })}
              className={`flex-1 rounded-full px-3 py-2 text-[14px] font-medium transition-colors ${p.arPose === pose ? "bg-card text-ink" : "text-ink-muted hover:text-ink"}`}
            >
              {pose === "upright" ? "Stands up" : "Lies flat"}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-soft">Offer badge</span>
        <input value={p.offer ?? ""} onChange={(e) => onChange({ offer: e.target.value.slice(0, 40) || null })} placeholder="₹50 off this week" className={field} />
      </label>

      {mode === "creator" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-soft">Buy link</span>
          <input value={p.link ?? ""} onChange={(e) => onChange({ link: e.target.value.trim() || null })} placeholder="https://" className={field} />
        </label>
      )}

      {mode === "shop" && (
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-paper px-3.5 py-3">
          <span className="flex flex-col">
            <span className="text-[15px] text-ink">Sold out</span>
            <span className="text-[13px] text-ink-muted">Stays on the page, with Order turned off</span>
          </span>
          <input type="checkbox" checked={p.soldOut} onChange={(e) => onChange({ soldOut: e.target.checked })} className="size-5 accent-[var(--color-cobalt-500)]" />
        </label>
      )}

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-paper px-3.5 py-3">
        <span className="text-[15px] text-ink">Show on the shop page</span>
        <input type="checkbox" checked={!p.hidden} onChange={(e) => onChange({ hidden: !e.target.checked })} className="size-5 accent-[var(--color-cobalt-500)]" />
      </label>
    </div>
  );
}

export function ProductsTab({
  page,
  token,
  issues,
  onProduct,
  onReorder,
  demo,
}: {
  page: EditorPage;
  token: string;
  issues: string[];
  published: boolean;
  /** the landing page's copy: edits stay in the browser, nothing that needs an edit key is shown */
  demo?: boolean;
  onProduct: (id: string, patch: Partial<EditorProduct>) => void;
  onReorder: (products: EditorProduct[]) => void;
}) {
  const [selectedId, setSelectedId] = useState(page.products[0]?.id ?? "");
  const selected = useMemo(() => page.products.find((p) => p.id === selectedId) ?? page.products[0], [page.products, selectedId]);
  const index = page.products.findIndex((p) => p.id === selected?.id);
  const shown = page.products.filter((p) => !p.hidden).length;

  const move = (dir: -1 | 1) => {
    const list = [...page.products];
    const [item] = list.splice(index, 1);
    if (!item) return;
    list.splice(Math.max(0, Math.min(list.length, index + dir)), 0, item);
    onReorder(list.map((x, n) => ({ ...x, order: n })));
  };

  if (!selected) return <p className="p-10 text-center text-ink-muted">No products in this photo.</p>;

  return (
    <div className="h-full overflow-y-auto lg:grid lg:grid-cols-[288px_minmax(0,1fr)_360px] lg:overflow-hidden">
      {/* the list: a strip of thumbnails on a phone, a column on a wide screen */}
      <aside className="flex min-h-0 flex-col lg:overflow-hidden lg:border-r lg:border-paper-deep">
        <div className="px-4 pb-2 pt-4">
          <h2 className="text-[16px] font-semibold text-ink">
            {page.products.length} products <span className="font-normal text-ink-muted">· {shown} on the page</span>
          </h2>
          <p className={`mt-1 text-[13px] ${issues.length ? "text-cobalt-700" : "text-ink-muted"}`}>{issues[0] ?? "Every product has a price and a size. Ready to share."}</p>
        </div>
        <ul className="flex gap-1 overflow-x-auto px-2 pb-3 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:pb-4 [&>li]:w-60 [&>li]:shrink-0 lg:[&>li]:w-auto">
          {page.products.map((p) => (
            <Row key={p.id} p={p} selected={p.id === selected.id} onSelect={() => setSelectedId(p.id)} />
          ))}
        </ul>
      </aside>

      {/* the stage */}
      <section className="bg-studio relative mx-2 flex flex-col rounded-xl lg:mx-0 lg:min-h-0 lg:overflow-y-auto lg:rounded-none" aria-label="3D preview">
        <div className="bg-grid pointer-events-none absolute inset-0 rounded-xl lg:rounded-none" aria-hidden />
        <div className="relative flex items-center justify-between gap-2 px-4 pt-3 text-[13px] text-ink-muted">
          <span>Drag to turn. This is the model customers see.</span>
          <span className="flex shrink-0 gap-1">
            <button type="button" onClick={() => move(-1)} disabled={index <= 0} aria-label="Move earlier on the shop page" className="rounded-full bg-card px-3 py-1.5 font-medium text-ink-soft disabled:opacity-40">
              Earlier
            </button>
            <button type="button" onClick={() => move(1)} disabled={index >= page.products.length - 1} aria-label="Move later on the shop page" className="rounded-full bg-card px-3 py-1.5 font-medium text-ink-soft disabled:opacity-40">
              Later
            </button>
          </span>
        </div>
        <div className="relative mx-auto w-full max-w-[340px] px-4 lg:flex lg:max-w-[560px] lg:flex-1 lg:items-center">
          {selected.glbUrl ? (
            <ProductModel key={selected.id} src={selected.glbUrl} arSrc={null} alt={selected.name} poster={selected.cutoutUrl} />
          ) : (
            <p className="py-20 text-center text-ink-muted">This product has no 3D model.</p>
          )}
        </div>
        <div className="relative flex flex-col gap-4 px-4 pb-5">
          <RealSize p={selected} />
          {page.published && !demo && selected.sizeM !== null && !selected.hidden && <TryInRoom slug={page.slug} productId={selected.id} />}
        </div>
      </section>

      {/* the details */}
      <aside className="px-4 py-5 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-paper-deep" aria-label="Product details">
        <h2 className="font-display mb-4 text-[30px] leading-none text-ink">{selected.name}</h2>
        <Inspector p={selected} mode={page.mode} pageId={page.id} token={token} demo={demo} onChange={(patch) => onProduct(selected.id, patch)} />
      </aside>
    </div>
  );
}
