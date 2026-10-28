"use client";

// The public shop: the seller's name, every product as a card, and a sheet per product with the model in 3D,
// "See it in your room" at real size, and the order or buy button. Visits are counted anonymously per product.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatPrice, formatSize, isInAppBrowser, referenceFor, whatsappOrderUrl } from "@/lib/shop/links";
import type { SampleNote } from "@/lib/shop/samples";
import type { Shop, ShopProduct } from "@/lib/shop/shops";
import { track } from "@/lib/shop/track";
import { AskBox } from "./ask-box";
import { ProductModel } from "./product-model";

function Avatar({ shop }: { shop: Shop }) {
  if (shop.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={shop.avatarUrl} alt="" className="size-16 rounded-full object-cover" />;
  }
  return (
    <div className="flex size-16 items-center justify-center rounded-full bg-cobalt-500 font-display text-[34px] leading-none text-white" aria-hidden>
      {shop.title.trim().charAt(0).toUpperCase()}
    </div>
  );
}

function ProductCard({ product, onOpen }: { product: ShopProduct; onOpen: () => void }) {
  const image = product.styledUrl ?? product.cutoutUrl;
  return (
    <button type="button" onClick={onOpen} className="group flex flex-col items-center gap-3 text-center">
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl bg-paper-deep transition-transform duration-300 group-active:scale-[0.98]">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            className={product.styledUrl ? "size-full object-cover" : "shadow-object max-h-[72%] max-w-[72%] object-contain transition-transform duration-500 group-hover:scale-105"}
          />
        )}
        <span className="absolute bottom-3 right-3 rounded-full bg-card/90 px-2.5 py-1 text-[12px] font-semibold text-ink-soft">3D</span>
        {product.offer && <span className="absolute left-3 top-3 rounded-full bg-cobalt-500 px-2.5 py-1 text-[12px] font-semibold text-white">{product.offer}</span>}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[16px] font-medium leading-snug text-ink">{product.name}</span>
        {product.price !== null && <span className="text-[15px] text-ink-muted">{formatPrice(product.price, product.currency)}</span>}
      </div>
    </button>
  );
}

function ProductSheet({ shop, product, pageUrl, onClose }: { shop: Shop; product: ShopProduct; pageUrl: string; onClose: () => void }) {
  const [inApp, setInApp] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | undefined>();
  useEffect(() => setInApp(isInAppBrowser(navigator.userAgent)), []);
  const onArStart = useCallback(() => track(shop.id, "open_ar", product.id), [shop.id, product.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const order =
    shop.mode === "shop" && shop.whatsapp
      ? { href: whatsappOrderUrl(shop.whatsapp, product, pageUrl, orderMessage), label: "Order on WhatsApp" }
      : product.link
        ? { href: product.link, label: "Buy" }
        : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-label={product.name}>
      <button type="button" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div className="kit-settle relative flex max-h-[94svh] w-full max-w-[520px] flex-col overflow-y-auto rounded-t-[32px] bg-card pb-[max(env(safe-area-inset-bottom),20px)] sm:rounded-[32px]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-paper text-[22px] leading-none text-ink-muted transition-colors hover:text-ink"
          aria-label="Close"
        >
          ×
        </button>
        <div className="bg-studio rounded-t-[32px] px-4 pt-4 sm:rounded-t-[32px]">
          <ProductModel src={product.glbUrl} arSrc={product.arUrl} alt={product.name} poster={product.cutoutUrl} onArStart={onArStart} />
        </div>
        <div className="flex flex-col items-center gap-4 px-6 pt-6 text-center">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-[40px] leading-[0.95] text-ink">{product.name}</h2>
            {product.price !== null && (
              <p className="text-[19px] text-ink-soft">
                {formatPrice(product.price, product.currency)}
                {product.offer && <span className="ml-2 rounded-full bg-cobalt-500 px-2.5 py-0.5 align-middle text-[13px] font-semibold text-white">{product.offer}</span>}
              </p>
            )}
          </div>
          {product.sizeM !== null && (
            <p className="text-[15px] text-ink-muted">
              About {formatSize(product.sizeM)} on its longest side. {product.arUrl ? "Shown at real size in your room." : ""}
            </p>
          )}
          {product.description && <p className="max-w-[40ch] text-[16px] text-ink">{product.description}</p>}
          {product.sizeImageUrl && product.sizeM !== null && (
            <figure className="flex w-full flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.sizeImageUrl} alt={`${product.name} next to ${referenceFor(product.sizeM).label}, to scale`} className="w-full rounded-2xl" />
              <figcaption className="text-[13px] text-ink-muted">
                To scale: {formatSize(product.sizeM)} next to {referenceFor(product.sizeM).label}. Each mark on the bar is 1 cm.
              </figcaption>
            </figure>
          )}
          {shop.published && <AskBox slug={shop.slug} product={product} onOrderMessage={setOrderMessage} />}
          {inApp && product.arUrl && (
            <p className="rounded-2xl bg-paper px-4 py-3 text-[14px] text-ink-muted">To see it in your room, open this page in Safari or Chrome.</p>
          )}
          {order && (
            <a
              href={order.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track(shop.id, "buy", product.id)}
              className="kit-press mt-1 w-full rounded-full bg-cobalt-500 px-7 py-4 text-[17px] font-medium text-white hover:bg-cobalt-600"
            >
              {order.label}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function ShopView({ shop, pageUrl, sample }: { shop: Shop; pageUrl: string; sample?: SampleNote }) {
  const [open, setOpen] = useState<ShopProduct | null>(null);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    // embedded copies (the landing page, the editor preview) don't count as visits
    if (shop.published && window.self === window.top) track(shop.id, "view");
  }, [shop.id, shop.published]);

  return (
    <main className="bg-studio relative isolate min-h-svh">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <header className="mx-auto flex max-w-[960px] flex-col items-center gap-3 px-5 pb-8 pt-12 text-center sm:pt-16">
        <Avatar shop={shop} />
        <h1 className="font-display text-[clamp(2.75rem,1.6rem+4.6vw,4.75rem)] leading-[0.92] text-ink">{shop.title}</h1>
        {shop.handle && <p className="text-[16px] text-ink-muted">@{shop.handle.replace(/^@/, "")}</p>}
        <p className="max-w-[34ch] text-[16px] text-ink-soft">
          {shop.products.length} {shop.products.length === 1 ? "product" : "products"}. Tap one to turn it in 3D and see it in your room.
        </p>
      </header>

      <section className="mx-auto grid max-w-[960px] grid-cols-2 gap-x-4 gap-y-8 px-4 pb-20 sm:grid-cols-3 sm:gap-x-6 sm:px-8">
        {shop.products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            onOpen={() => {
              setOpen(p);
              track(shop.id, "open_3d", p.id);
            }}
          />
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
        <Link href="/new" className="font-medium text-cobalt-600 underline-offset-4 hover:underline">
          Make your own shop link
        </Link>
      </footer>

      {open && <ProductSheet shop={shop} product={open} pageUrl={pageUrl} onClose={close} />}
    </main>
  );
}
