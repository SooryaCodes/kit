// Public shop page: every product from one photo, in 3D, with "See it in your room" and order on WhatsApp.

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ShopView } from "@/components/shop/shop-view";
import { getShop } from "@/lib/shop/shops";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9][a-z0-9-]{2,39}$/;

async function pageUrl(slug: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/k/${slug}`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const shop = SLUG.test(slug) ? await getShop(slug) : null;
  if (!shop) return { title: "Kit" };
  const title = `${shop.title} · see every product in 3D`;
  const description = `${shop.products.length} products you can turn in 3D and place in your room. Order on WhatsApp.`;
  const image = shop.products[0]?.styledUrl ?? shop.products[0]?.cutoutUrl;
  return { title, description, openGraph: { title, description, images: image ? [{ url: image }] : [] } };
}

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const shop = await getShop(slug);
  if (!shop) notFound();
  return <ShopView shop={shop} pageUrl={await pageUrl(slug)} />;
}
