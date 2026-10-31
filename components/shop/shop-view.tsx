"use client";

// The public shop. A header with who the shop is and how to reach it, every product as a card with its price and
// real size, and a sheet per product: the model in 3D, its photo and its real size, "See it in your room" (or a
// QR code to open the same product on a phone), questions, and an order bar that stays in view.
// ?p=<product id> opens a product directly, which is what the QR code links to.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QrCode } from "@/components/studio/share";
import { formatPrice, formatSize, referenceFor, whatsappOrderUrl } from "@/lib/shop/links";
import type { SampleNote } from "@/lib/shop/samples";
import type { Shop, ShopProduct } from "@/lib/shop/shops";
import { track } from "@/lib/shop/track";
import { AskBox } from "./ask-box";
import { ProductModel } from "./product-model";
import { ShopRoomButton } from "./shop-room";

type View = "3d" | "photo" | "size";

function isPhone(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function Avatar({ shop }: { shop: Shop }) {
  if (shop.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={shop.avatarUrl} alt="" className="size-14 rounded-full object-cover" />;
  }
  return (
    <div className="flex size-14 items-center justify-center rounded-full bg-cobalt-500 font-display text-[30px] leading-none text-white" aria-hidden>
      {shop.title.trim().charAt(0).toUpperCase()}
    </div>
  );
}

function ProductCard({ product, onOpen }: { product: ShopProduct; onOpen: () => void }) {
  const image = product.styledUrl ?? product.cutoutUrl;
  return (
    <button type="button" onClick={onOpen} className="group flex flex-col gap-2.5 text-left">
      <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl bg-paper-deep transition-transform duration-300 group-active:scale-[0.98]">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            className={product.styledUrl ? "size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" : "shadow-object max-h-[72%] max-w-[72%] object-contain transition-transform duration-500 group-hover:scale-105"}
          />
        )}
        <span className="absolute bottom-2.5 right-2.5 rounded-full bg-card/90 px-2.5 py-1 text-[12px] font-semibold text-ink-soft">3D</span>
        {product.offer && <span className="absolute left-2.5 top-2.5 rounded-full bg-cobalt-500 px-2.5 py-1 text-[12px] font-semibold text-white">{product.offer}</span>}
      </span>
      <span className="flex flex-col gap-0.5 px-1">
        <span className="text-[16px] font-medium leading-snug text-ink">{product.name}</span>
        <span className="text-[15px] tabular-nums text-ink-muted">
          {product.price !== null ? formatPrice(product.price, product.currency) : "Ask for price"}
          {product.sizeM !== null && ` · ${formatSize(product.sizeM)}`}
        </span>
      </span>
    </button>
  );
}

/** The product against an everyday object, both bars to one scale. */
function SizeBars({ product }: { product: ShopProduct }) {
  if (product.sizeM === null) return null;
  const ref = referenceFor(product.sizeM);
  const refCm = Math.max(ref.widthCm, ref.heightCm);
  const cm = product.sizeM * 100;
  const max = Math.max(cm, refCm);
  return (
    <div className="flex w-full flex-col gap-2">
      {[
        { label: product.name, cm, tone: "bg-cobalt-500" },
        { label: ref.label.replace(/^an? /, "").replace(/^\w/, (c) => c.toUpperCase()), cm: refCm, tone: "bg-ink/25" },
      ].map((b) => (
        <div key={b.label} className="grid grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-3 text-[13px]">
          <span className="truncate text-ink-soft">{b.label}</span>
          <span className="h-2.5 rounded-full bg-paper-deep">
            <span className={`block h-full rounded-full ${b.tone}`} style={{ width: `${(b.cm / max) * 100}%` }} />
          </span>
          <span className="w-14 text-right tabular-nums text-ink">{Math.round(b.cm * 10) / 10} cm</span>
        </div>
      ))}
    </div>
  );
}

function ProductSheet({
  shop,
  product,
  index,
  pageUrl,
  onClose,
  onStep,
}: {
  shop: Shop;
  product: ShopProduct;
  index: number;
  pageUrl: string;
  onClose: () => void;
  onStep: (dir: -1 | 1) => void;
}) {
  const [view, setView] = useState<View>("3d");
  const [phone, setPhone] = useState(true);
  const [orderMessage, setOrderMessage] = useState<string | undefined>();
  const onArStart = useCallback(() => track(shop.id, "open_ar", product.id), [shop.id, product.id]);

  useEffect(() => {
    setPhone(isPhone());
  }, []);
  useEffect(() => {
    setView("3d");
    setOrderMessage(undefined);
  }, [product.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onStep(1);
      if (e.key === "ArrowLeft") onStep(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onStep]);

  const order =
    shop.mode === "shop" && shop.whatsapp
      ? { href: whatsappOrderUrl(shop.whatsapp, product, pageUrl, orderMessage), label: "Order on WhatsApp" }
      : product.link
        ? { href: product.link, label: "Buy" }
        : null;
  const views: { id: View; label: string }[] = [
    { id: "3d", label: "3D" },
    ...(product.styledUrl || product.cutoutUrl ? [{ id: "photo" as const, label: "Photo" }] : []),
    ...(product.sizeM !== null ? [{ id: "size" as const, label: "Real size" }] : []),
  ];
  const productLink = `${pageUrl}?p=${product.id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal aria-label={product.name}>
      <button type="button" className="absolute inset-0 bg-ink/40" onClick={onClose} aria-label="Close" />
      <div className="kit-settle relative flex h-[94svh] w-full max-w-[980px] flex-col overflow-hidden rounded-t-[32px] bg-card sm:h-auto sm:max-h-[90svh] sm:rounded-[32px]">
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3 sm:px-5 sm:pt-4">
          <span className="text-[13px] tabular-nums text-ink-muted">
            {index + 1} of {shop.products.length}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onStep(-1)} className="flex size-10 items-center justify-center rounded-full text-[20px] text-ink-soft hover:bg-paper" aria-label="Previous product">
              ‹
            </button>
            <button type="button" onClick={() => onStep(1)} className="flex size-10 items-center justify-center rounded-full text-[20px] text-ink-soft hover:bg-paper" aria-label="Next product">
              ›
            </button>
            <button type="button" onClick={onClose} className="ml-1 flex size-10 items-center justify-center rounded-full bg-paper text-[22px] leading-none text-ink-muted hover:text-ink" aria-label="Close">
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:overflow-hidden">
          {/* the product itself */}
          <div className="flex flex-col gap-3 px-4 pt-2 sm:overflow-y-auto sm:px-5 sm:pb-5">
            <div className="bg-studio relative overflow-hidden rounded-3xl">
              {view === "3d" && <ProductModel src={product.arUrl ?? product.glbUrl} arSrc={product.arUrl} alt={product.name} poster={product.cutoutUrl} onArStart={onArStart} />}
              {view === "photo" && (
                <div className="flex aspect-square items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.styledUrl ?? product.cutoutUrl ?? undefined} alt={product.name} className={product.styledUrl ? "size-full object-cover" : "shadow-object max-h-[72%] max-w-[72%] object-contain"} />
                </div>
              )}
              {view === "size" && (
                <div className="flex aspect-square flex-col items-center justify-center gap-6 p-6">
                  {product.sizeImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.sizeImageUrl} alt={`${product.name} next to ${referenceFor(product.sizeM!).label}, to scale`} className="w-full rounded-2xl" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    product.cutoutUrl && <img src={product.cutoutUrl} alt="" className="shadow-object max-h-[50%] max-w-[60%] object-contain" />
                  )}
                  <SizeBars product={product} />
                </div>
              )}
            </div>
            {views.length > 1 && (
              <div className="flex gap-1 self-center rounded-full bg-paper-deep p-1" role="tablist" aria-label="View">
                {views.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={view === v.id}
                    onClick={() => setView(v.id)}
                    className={`rounded-full px-4 py-1.5 text-[14px] font-medium transition-colors ${view === v.id ? "bg-card text-ink" : "text-ink-muted hover:text-ink"}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}
            {product.arUrl && !phone && (
              <div className="flex items-center gap-4 rounded-2xl bg-paper p-3">
                <QrCode url={productLink} size={92} />
                <p className="text-[14px] leading-[1.45] text-ink-soft">Scan with your phone to see it in your room, at real size.</p>
              </div>
            )}
          </div>

          {/* what it is, questions */}
          <div className="flex flex-col gap-5 px-5 pb-6 pt-5 sm:overflow-y-auto sm:pt-2">
            <div className="flex flex-col gap-1.5">
              <h2 className="font-display text-[clamp(34px,3.4vw,46px)] leading-[0.95] text-ink">{product.name}</h2>
              <p className="flex flex-wrap items-center gap-2 text-[19px] tabular-nums text-ink-soft">
                {product.price !== null ? formatPrice(product.price, product.currency) : "Ask for the price"}
                {product.offer && <span className="rounded-full bg-cobalt-500 px-2.5 py-0.5 text-[13px] font-semibold text-white">{product.offer}</span>}
              </p>
              {product.sizeM !== null && <p className="text-[15px] text-ink-muted">About {formatSize(product.sizeM)} on its longest side.</p>}
            </div>
            {product.description && <p className="text-[16px] leading-[1.55] text-ink">{product.description}</p>}
            {shop.published && <AskBox slug={shop.slug} product={product} onOrderMessage={setOrderMessage} />}
            <p className="text-[12px] text-ink-faint">The 3D model is rebuilt from one photo, so its back is a best guess. The photo shows the real product.</p>
          </div>
        </div>

        {/* the order bar, always in view */}
        {order && (
          <div className="flex shrink-0 items-center gap-3 border-t border-paper-deep bg-card px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:px-5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] text-ink-muted">{product.name}</span>
              <span className="block text-[17px] font-semibold tabular-nums text-ink">{product.price !== null ? formatPrice(product.price, product.currency) : "Ask for the price"}</span>
            </span>
            <a
              href={order.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track(shop.id, "buy", product.id)}
              className="kit-press flex h-12 shrink-0 items-center rounded-full bg-cobalt-500 px-6 text-[16px] font-medium text-white hover:bg-cobalt-600"
            >
              {order.label}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export function ShopView({ shop, pageUrl, sample }: { shop: Shop; pageUrl: string; sample?: SampleNote }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const index = useMemo(() => shop.products.findIndex((p) => p.id === openId), [shop.products, openId]);
  const open = index >= 0 ? shop.products[index]! : null;

  const show = useCallback(
    (id: string | null) => {
      setOpenId(id);
      if (id) track(shop.id, "open_3d", id);
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("p", id);
      else url.searchParams.delete("p");
      window.history.replaceState(null, "", url);
    },
    [shop.id],
  );
  const close = useCallback(() => show(null), [show]);
  const step = useCallback(
    (dir: -1 | 1) => {
      if (index < 0) return;
      const next = shop.products[(index + dir + shop.products.length) % shop.products.length];
      if (next) show(next.id);
    },
    [index, shop.products, show],
  );

  useEffect(() => {
    // embedded copies (the landing page, the editor preview) don't count as visits
    if (shop.published && window.self === window.top) track(shop.id, "view");
    const wanted = new URL(window.location.href).searchParams.get("p");
    if (wanted && shop.products.some((p) => p.id === wanted)) show(wanted);
  }, [shop.id, shop.published, shop.products, show]);

  async function share() {
    const data = { title: shop.title, text: `${shop.title}: see every product in 3D`, url: pageUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(pageUrl);
        setShared(true);
        setTimeout(() => setShared(false), 1600);
      }
    } catch {
      // the share sheet was dismissed
    }
  }

  const chat = shop.mode === "shop" && shop.whatsapp ? `https://wa.me/${shop.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I saw your shop on Kit: ${pageUrl}`)}` : null;

  return (
    <main className="bg-studio relative isolate min-h-svh">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <header className="mx-auto flex max-w-[1040px] flex-col items-center gap-4 px-5 pb-10 pt-10 text-center sm:pt-14">
        <Avatar shop={shop} />
        <div className="flex flex-col items-center gap-1.5">
          <h1 className="font-display text-[clamp(2.75rem,1.6rem+4.6vw,4.75rem)] leading-[0.92] text-ink">{shop.title}</h1>
          {shop.handle && <p className="text-[16px] text-ink-muted">@{shop.handle.replace(/^@/, "")}</p>}
        </div>
        <p className="max-w-[36ch] text-[16px] leading-[1.5] text-ink-soft">
          {shop.products.length} {shop.products.length === 1 ? "product" : "products"} in 3D. Turn any of them, see it in your room at real size, and {shop.mode === "shop" ? "order on WhatsApp" : "buy through the link"}.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {chat && (
            <a href={chat} target="_blank" rel="noopener noreferrer" className="kit-press flex h-11 items-center rounded-full bg-ink px-5 text-[15px] font-medium text-white hover:bg-ink-soft">
              Message on WhatsApp
            </a>
          )}
          <button type="button" onClick={share} className="kit-press flex h-11 items-center rounded-full bg-paper-deep px-5 text-[15px] font-medium text-ink hover:bg-paper-shade">
            {shared ? "Link copied" : "Share this shop"}
          </button>
        </div>
        {shop.published && shop.products.filter((p) => p.arUrl).length >= 2 && (
          <ShopRoomButton slug={shop.slug} arUrls={shop.products.flatMap((p) => (p.arUrl ? [p.arUrl] : []))} pageUrl={pageUrl} onStart={() => track(shop.id, "open_ar")} />
        )}
      </header>

      <section aria-label="Products" className="mx-auto grid max-w-[1040px] grid-cols-2 gap-x-3 gap-y-7 px-4 pb-20 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-10 sm:px-8">
        {shop.products.map((p) => (
          <ProductCard key={p.id} product={p} onOpen={() => show(p.id)} />
        ))}
      </section>

      {sample && (
        <p className="mx-auto -mt-8 mb-12 max-w-[40ch] px-5 text-center text-[14px] text-ink-muted">
          This is a sample shop, so orders don&apos;t reach anyone.{" "}
          <a href={sample.creditUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            {sample.credit}
          </a>
          .
        </p>
      )}
      <footer className="flex flex-col items-center gap-2 pb-14 text-center text-[14px] text-ink-faint">
        <Link href="/" className="font-display text-[26px] leading-none text-ink">
          Kit
        </Link>
        <span>Every product here was photographed once and rebuilt in 3D.</span>
        <Link href="/new?mode=shop" className="font-medium text-cobalt-600 underline-offset-4 hover:underline">
          Make your own shop link
        </Link>
      </footer>

      {open && <ProductSheet shop={shop} product={open} index={index} pageUrl={pageUrl} onClose={close} onStep={step} />}
    </main>
  );
}
