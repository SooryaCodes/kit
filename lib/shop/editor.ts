// Seller side of a shop page: create the draft from a finished job, read it for the editor, save edits, publish.
// No accounts: whoever creates the draft gets an edit token once (kept in their browser); every edit must carry it.

import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { resumeJob } from "../budget";
import { createLogger, errorMessage } from "../log";
import { photoFromBuffer } from "../pipeline/photo";
import { supabaseAdmin } from "../supabase/server";
import { downloadFile, publicUrl, signedUrl } from "../supabase/storage";
import { arModelUrlAs } from "./ar";
import { describeProducts } from "./details";
import { makeStyledShot } from "./images";
import { hashToken, newEditToken, shopInfoOf, type ShopInfo } from "./shops";
import { cellFor, isShopifySource } from "./shopify";

const log = createLogger("shop:editor");

export class EditError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AUD: "A$", CAD: "C$", SGD: "S$", AED: "AED " };
const currencySymbol = (code: string) => SYMBOLS[code] ?? `${code} `;

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const randomSlug = () => `shop-${Array.from(randomBytes(5), (b) => ALPHABET[b % ALPHABET.length]).join("")}`;

/** Creates the draft page for a finished job and suggests product details. Returns the edit token once. */
export async function createDraftPage(jobId: string): Promise<{ pageId: string; slug: string; token: string }> {
  const db = supabaseAdmin();
  const { data: job } = await db.from("jobs").select("id, status, photo_path, cost, source").eq("id", jobId).maybeSingle();
  if (!job) throw new EditError(404, "job not found");
  if (job.status !== "ready") throw new EditError(409, "the 3D build is not finished yet");
  const { data: existing } = await db.from("pages").select("id").eq("job_id", jobId).maybeSingle();
  if (existing) throw new EditError(409, "this photo already has a shop page");

  // suggestions first, so the editor opens with names, descriptions and sizes filled in
  const { data: items } = await db.from("items").select("id, idx, name, box, user_edited").eq("job_id", jobId).eq("status", "ready").order("idx");
  const shopify = isShopifySource(job.source) ? job.source : null;
  if (items?.length && job.photo_path) {
    try {
      const photo = await photoFromBuffer(await downloadFile("photos", job.photo_path));
      type Box = { left: number; top: number; right: number; bottom: number };
      // imported from a store: each grid cell is one product; the biggest thing found in a cell is that product
      const cellOf = new Map<string, NonNullable<ReturnType<typeof cellFor>>>();
      const extra = new Set<string>();
      if (shopify) {
        const best = new Map<number, { id: string; area: number }>();
        for (const i of items) {
          const box = i.box as Box;
          const cell = cellFor(shopify, box, photo.width);
          if (!cell) continue;
          cellOf.set(i.id, cell);
          const key = shopify.cells.indexOf(cell);
          const area = (box.right - box.left) * (box.bottom - box.top);
          const prev = best.get(key);
          if (prev) extra.add(area > prev.area ? prev.id : i.id);
          if (!prev || area > prev.area) best.set(key, { id: i.id, area });
        }
      }
      const details = await describeProducts(
        photo,
        items.map((i) => ({ idx: i.idx, name: (!extra.has(i.id) && cellOf.get(i.id)?.product.title) || i.name, box: i.box as Box })),
        resumeJob(jobId, 0),
      );
      const { products: described, view } = details;
      const byIdx = new Map(described.map((d) => [d.idx, d]));
      await Promise.all(
        items.map((i, order) => {
          const d = byIdx.get(i.idx);
          const store = extra.has(i.id) ? null : cellOf.get(i.id)?.product;
          return db
            .from("items")
            .update({
              ...(d && !i.user_edited ? { name: d.name } : {}),
              description: d?.description ?? null,
              real_size_m: d ? Math.round(d.size_cm) / 100 : null,
              ar_pose: view === "front" ? "upright" : "flat",
              display_order: order,
              // the store's own name, price, description and product link win over guesses from the photo
              ...(store
                ? { ...(i.user_edited ? {} : { name: store.title }), price: store.price, currency: currencySymbol(shopify!.store.currency), description: store.description || d?.description || null, link: store.url }
                : {}),
              ...(shopify && !store ? { hidden: true } : {}),
            })
            .eq("id", i.id);
        }),
      );
    } catch (err) {
      // the seller can still fill everything in by hand
      log.warn("product details failed", { job: jobId, error: errorMessage(err) });
    }
  }

  const token = newEditToken();
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = randomSlug();
    const { data: page, error } = await db
      .from("pages")
      .insert({ job_id: jobId, slug, title: shopify?.store.name.slice(0, 60) ?? "My shop", mode: "shop", city: shopify?.store.city?.slice(0, 40) ?? null })
      .select("id, slug")
      .single();
    if (error?.code === "23505") continue;
    if (error || !page) throw new Error(`could not create page: ${error?.message}`);
    await db.from("page_secrets").insert({ page_id: page.id, edit_token_hash: hashToken(token) });
    log.info("draft page created", { job: jobId, page: page.id });
    return { pageId: page.id, slug: page.slug, token };
  }
  throw new Error("could not pick a free page address");
}

export async function checkToken(pageId: string, token: string | null): Promise<void> {
  if (!token) throw new EditError(401, "missing edit token");
  const { data } = await supabaseAdmin().from("page_secrets").select("edit_token_hash").eq("page_id", pageId).maybeSingle();
  const want = Buffer.from(data?.edit_token_hash ?? "", "hex");
  const got = Buffer.from(hashToken(token), "hex");
  if (!data || want.length !== got.length || !timingSafeEqual(want, got)) throw new EditError(403, "this link can't edit that page");
}

export interface EditorProduct {
  id: string;
  name: string;
  price: number | null;
  description: string | null;
  sizeM: number | null;
  link: string | null;
  offer: string | null;
  /** how it is placed in a room: lying flat or standing up */
  arPose: "flat" | "upright";
  soldOut: boolean;
  hidden: boolean;
  order: number;
  cutoutUrl: string | null;
  glbUrl: string | null;
}

export interface EditorPage {
  id: string;
  slug: string;
  mode: "shop" | "creator";
  title: string;
  handle: string | null;
  whatsapp: string | null;
  affiliateTag: string | null;
  info: ShopInfo;
  published: boolean;
  products: EditorProduct[];
}

export async function getEditorPage(pageId: string, token: string | null): Promise<EditorPage> {
  await checkToken(pageId, token);
  const db = supabaseAdmin();
  const { data: page } = await db.from("pages").select("*").eq("id", pageId).single();
  if (!page) throw new EditError(404, "page not found");
  const { data: items } = await db
    .from("items")
    .select("id, idx, name, price, description, real_size_m, link, offer_label, ar_pose, sold_out, hidden, display_order, crop_path, glb_path")
    .eq("job_id", page.job_id)
    .eq("status", "ready")
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("idx");
  return {
    id: page.id,
    slug: page.slug,
    mode: page.mode === "creator" ? "creator" : "shop",
    title: page.title,
    handle: page.handle,
    whatsapp: page.whatsapp_number,
    affiliateTag: page.affiliate_tag,
    info: shopInfoOf(page),
    published: page.published,
    products: await Promise.all(
      (items ?? []).map(async (i, n) => ({
        id: i.id,
        name: i.name,
        price: i.price === null ? null : Number(i.price),
        description: i.description,
        sizeM: i.real_size_m === null ? null : Number(i.real_size_m),
        link: i.link,
        offer: i.offer_label,
        arPose: i.ar_pose === "upright" ? "upright" : "flat",
        soldOut: i.sold_out,
        hidden: i.hidden,
        order: i.display_order ?? n,
        cutoutUrl: i.crop_path ? await signedUrl("crops", i.crop_path, 6 * 60 * 60) : null,
        glbUrl: i.glb_path ? publicUrl("glbs", i.glb_path) : null,
      })),
    ),
  };
}

const PHONE = /^\+[1-9][0-9]{7,14}$/;
export const PagePatch = z.object({
  title: z.string().trim().min(1).max(60).optional(),
  handle: z.string().trim().max(40).nullable().optional(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{2,39}$/).optional(),
  mode: z.enum(["shop", "creator"]).optional(),
  whatsapp: z
    .string()
    .transform((v) => v.replace(/[\s()-]/g, ""))
    .refine((v) => v === "" || PHONE.test(v), "use the full number with country code, like +91 98765 43210")
    .nullable()
    .optional(),
  affiliateTag: z.string().trim().max(60).nullable().optional(),
  info: z
    .object({
      about: z.string().trim().max(140).nullable(),
      city: z.string().trim().max(40).nullable(),
      delivery: z.string().trim().max(80).nullable(),
      returns: z.string().trim().max(80).nullable(),
      cod: z.boolean(),
    })
    .optional(),
  published: z.boolean().optional(),
  products: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(60),
        price: z.number().nonnegative().max(10_000_000).nullable(),
        description: z.string().trim().max(400).nullable(),
        sizeM: z.number().positive().max(9.99).nullable(),
        link: z.string().trim().url().max(500).nullable(),
        offer: z.string().trim().max(40).nullable().optional(),
        arPose: z.enum(["flat", "upright"]).optional(),
        soldOut: z.boolean().optional(),
        hidden: z.boolean(),
        order: z.number().int().min(0),
      }),
    )
    .max(40)
    .optional(),
});
export type PagePatch = z.infer<typeof PagePatch>;

export async function updatePage(pageId: string, token: string | null, patch: PagePatch): Promise<EditorPage> {
  await checkToken(pageId, token);
  const db = supabaseAdmin();
  const { data: page } = await db.from("pages").select("id, job_id").eq("id", pageId).single();
  if (!page) throw new EditError(404, "page not found");

  const fields = {
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.handle !== undefined ? { handle: patch.handle?.replace(/^@/, "") || null } : {}),
    ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
    ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
    ...(patch.whatsapp !== undefined ? { whatsapp_number: patch.whatsapp || null } : {}),
    ...(patch.affiliateTag !== undefined ? { affiliate_tag: patch.affiliateTag || null } : {}),
    ...(patch.published !== undefined ? { published: patch.published } : {}),
    ...(patch.info
      ? {
          about: patch.info.about || null,
          city: patch.info.city || null,
          delivery_note: patch.info.delivery || null,
          returns_note: patch.info.returns || null,
          cod: patch.info.cod,
        }
      : {}),
  };
  if (Object.keys(fields).length) {
    const { error } = await db.from("pages").update(fields).eq("id", pageId);
    if (error?.code === "23505") throw new EditError(409, "that address is taken, try another");
    if (error) throw new Error(`could not save page: ${error.message}`);
  }
  if (patch.products?.length) {
    const ids = patch.products.map((p) => p.id);
    const { data: owned } = await db.from("items").select("id").eq("job_id", page.job_id).in("id", ids);
    const ok = new Set((owned ?? []).map((o) => o.id));
    await Promise.all(
      patch.products
        .filter((p) => ok.has(p.id))
        .map((p) =>
          db
            .from("items")
            .update({
              name: p.name,
              price: p.price,
              currency: "₹",
              description: p.description,
              real_size_m: p.sizeM,
              link: p.link,
              ...(p.offer !== undefined ? { offer_label: p.offer || null } : {}),
              ...(p.arPose ? { ar_pose: p.arPose } : {}),
              ...(p.soldOut !== undefined ? { sold_out: p.soldOut } : {}),
              hidden: p.hidden,
              display_order: p.order,
              user_edited: true,
            })
            .eq("id", p.id),
        ),
    );
  }
  return getEditorPage(pageId, token);
}

/**
 * Gets a published page ready for visitors: every real-size AR model built ahead of the first tap, and a
 * styled photo for each product (the real cut-out on the shop's Muse Image backdrop) for the product cards.
 */
export async function preparePage(pageId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: page } = await db.from("pages").select("job_id").eq("id", pageId).single();
  if (!page) return;
  const { data: items } = await db
    .from("items")
    .select("id, glb_path, real_size_m, ar_pose, crop_path, styled_image_path")
    .eq("job_id", page.job_id)
    .eq("hidden", false)
    .eq("status", "ready");
  for (const item of items ?? []) {
    try {
      // the GLB for Android and the USDZ for iPhone, both ready before the first tap
      await arModelUrlAs({ ...item, real_size_m: item.real_size_m === null ? null : Number(item.real_size_m) }, "usdz");
      if (!item.styled_image_path && item.crop_path) {
        await db.from("items").update({ styled_image_path: await makeStyledShot(pageId, item) }).eq("id", item.id);
      }
    } catch (err) {
      log.warn("page preparation failed for an item", { item: item.id, error: errorMessage(err) });
    }
  }
}
