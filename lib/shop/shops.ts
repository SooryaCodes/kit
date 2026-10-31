// Shop pages: one photo's products as a public link (/k/:slug).
// Reads go through the service role on the server; the public page only ever sees published pages and
// visible, ready items. Edit access is a random token whose hash lives in page_secrets.

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "../supabase/server";
import { publicUrl, signedUrl } from "../supabase/storage";

export type ShopMode = "shop" | "creator";

export interface ShopProduct {
  id: string;
  name: string;
  price: number | null;
  currency: string;
  description: string | null;
  /** longest side in metres, confirmed by the seller; null until confirmed */
  sizeM: number | null;
  /** buy link for creator pages */
  link: string | null;
  /** short offer badge the seller approved, like "₹50 off" */
  offer: string | null;
  /** true-size picture next to everyday objects */
  sizeImageUrl: string | null;
  cutoutUrl: string | null;
  styledUrl: string | null;
  glbUrl: string;
  /** real-size AR copy, served by /api/ar/:itemId once a size is confirmed */
  arUrl: string | null;
  arPose: "flat" | "upright";
}

export interface Shop {
  id: string;
  slug: string;
  mode: ShopMode;
  title: string;
  handle: string | null;
  avatarUrl: string | null;
  whatsapp: string | null;
  published: boolean;
  products: ShopProduct[];
}

const SIX_HOURS = 6 * 60 * 60;

export function hashToken(token: string): string {
  return createHash("sha256").update(`kit-edit:${token}`).digest("hex");
}

export function newEditToken(): string {
  return randomBytes(24).toString("base64url");
}

/** The shop for a slug, or null. A draft is returned only with its edit token (the editor's preview). */
export async function getShop(slug: string, opts: { previewToken?: string } = {}): Promise<Shop | null> {
  const db = supabaseAdmin();
  const { data: page } = await db.from("pages").select("*").eq("slug", slug).maybeSingle();
  if (!page) return null;
  if (!page.published) {
    if (!opts.previewToken) return null;
    const { data: secret } = await db.from("page_secrets").select("edit_token_hash").eq("page_id", page.id).maybeSingle();
    if (secret?.edit_token_hash !== hashToken(opts.previewToken)) return null;
  }

  const { data: items } = await db
    .from("items")
    .select("id, idx, name, price, currency, description, real_size_m, link, offer_label, ar_pose, size_image_path, crop_path, styled_image_path, glb_path, display_order, hidden, status")
    .eq("job_id", page.job_id)
    .eq("status", "ready")
    .eq("hidden", false)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("idx");

  const products = await Promise.all(
    (items ?? [])
      .filter((i) => i.glb_path)
      .map(async (i): Promise<ShopProduct> => ({
        id: i.id,
        name: i.name,
        price: i.price === null ? null : Number(i.price),
        currency: i.currency ?? "₹",
        description: i.description,
        sizeM: i.real_size_m === null ? null : Number(i.real_size_m),
        link: i.link,
        offer: i.offer_label,
        sizeImageUrl: i.size_image_path ? publicUrl("covers", i.size_image_path) : null,
        cutoutUrl: i.crop_path ? await signedUrl("crops", i.crop_path, SIX_HOURS) : null,
        styledUrl: i.styled_image_path ? publicUrl("covers", i.styled_image_path) : null,
        glbUrl: publicUrl("glbs", i.glb_path!),
        // size and pose in the link, so a change is never served from a stale cache
        arUrl: page.published && i.real_size_m ? `/api/ar/${i.id}?v=${Math.round(Number(i.real_size_m) * 1000)}-${i.ar_pose ?? "flat"}` : null,
        arPose: i.ar_pose === "upright" ? "upright" : "flat",
      })),
  );

  return {
    id: page.id,
    slug: page.slug,
    mode: page.mode === "creator" ? "creator" : "shop",
    title: page.title,
    handle: page.handle,
    avatarUrl: page.avatar_path ? publicUrl("covers", page.avatar_path) : null,
    whatsapp: page.whatsapp_number,
    published: page.published,
    products,
  };
}
