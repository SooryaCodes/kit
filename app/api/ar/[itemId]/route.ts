// GET /api/ar/:itemId → the item's real-size AR model (built once, then served from storage).
// Only items on a published shop page, with a confirmed size, have one.

import { NextResponse } from "next/server";
import { createLogger, errorMessage } from "@/lib/log";
import { arModelUrl } from "@/lib/shop/ar";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = createLogger("api:ar");
const UUID = /^[0-9a-f-]{36}$/;

export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  if (!UUID.test(itemId)) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const db = supabaseAdmin();
    const { data: item } = await db.from("items").select("id, job_id, glb_path, real_size_m, hidden").eq("id", itemId).maybeSingle();
    if (!item || item.hidden) return NextResponse.json({ error: "not found" }, { status: 404 });
    const { data: page } = await db.from("pages").select("id").eq("job_id", item.job_id).eq("published", true).limit(1).maybeSingle();
    if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });
    const url = await arModelUrl(item);
    if (!url) return NextResponse.json({ error: "no confirmed size" }, { status: 404 });
    return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "public, max-age=300" } });
  } catch (err) {
    log.error("ar model failed", { item: itemId, error: errorMessage(err) });
    return NextResponse.json({ error: "could not prepare the AR model" }, { status: 500 });
  }
}
