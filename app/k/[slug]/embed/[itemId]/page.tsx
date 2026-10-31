// One product in 3D, made to sit inside any store's product page (Shopify, WooCommerce, Dukaan) as an iframe.
// It turns in place; "See it in your room" opens the product's Kit page in a new tab, where AR opens reliably.

import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductModel } from "@/components/shop/product-model";
import { getShop } from "@/lib/shop/shops";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "3D view · Kit", robots: { index: false } };

const SLUG = /^[a-z0-9][a-z0-9-]{2,39}$/;
const UUID = /^[0-9a-f-]{36}$/;

export default async function EmbedPage({ params }: { params: Promise<{ slug: string; itemId: string }> }) {
  const { slug, itemId } = await params;
  if (!SLUG.test(slug) || !UUID.test(itemId)) notFound();
  const shop = await getShop(slug);
  const product = shop?.products.find((p) => p.id === itemId);
  if (!shop || !product) notFound();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const productUrl = `${proto}://${host}/k/${slug}?p=${product.id}`;

  return (
    <main className="bg-studio relative flex min-h-svh items-center justify-center">
      <div className="w-full max-w-[640px]">
        <ProductModel src={product.arUrl ?? product.glbUrl} arSrc={null} alt={product.name} poster={product.cutoutUrl} arLink={product.arUrl ? productUrl : undefined} />
      </div>
      <Link href={productUrl} target="_blank" className="absolute right-3 top-3 font-display text-[18px] leading-none text-ink/60 hover:text-ink" aria-label="Open on Kit">
        Kit
      </Link>
    </main>
  );
}
