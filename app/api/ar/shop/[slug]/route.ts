// GET /api/ar/shop/:slug → the whole shop as one real-size AR model (every visible product with a size, in rows).

import { NextResponse } from "next/server";
import { createLogger, errorMessage } from "@/lib/log";
import { shopArUrl } from "@/lib/shop/ar";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const log = createLogger("api:ar-shop");
const SLUG = /^[a-z0-9][a-z0-9-]{2,39}$/;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const db = supabaseAdmin();
    const { data: page } = await db.from("pages").select("id, job_id, published").eq("slug", slug).maybeSingle();
    if (!page?.published) return NextResponse.json({ error: "not found" }, { status: 404 });
    const { data: items } = await db
      .from("items")
      .select("id, glb_path, real_size_m, ar_pose")
      .eq("job_id", page.job_id)
      .eq("status", "ready")
      .eq("hidden", false)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("idx");
    const url = await shopArUrl(
      page.id,
      (items ?? []).map((i) => ({ ...i, real_size_m: i.real_size_m === null ? null : Number(i.real_size_m) })),
    );
    if (!url) return NextResponse.json({ error: "needs at least two products with a size" }, { status: 404 });
    return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "public, max-age=300" } });
  } catch (err) {
    log.error("shop ar model failed", { slug, error: errorMessage(err) });
    return NextResponse.json({ error: "could not prepare the AR model" }, { status: 500 });
  }
}
