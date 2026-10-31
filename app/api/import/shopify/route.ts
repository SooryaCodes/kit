// POST /api/import/shopify { url } → reads a Shopify store's public products, lays their photos out as one grid
// and starts the usual job on it (find, cut out, rebuild in 3D). The draft page takes each product's store details.

import { after, NextResponse } from "next/server";
import { BudgetError } from "@/lib/budget";
import { checkCanStart, createJob, runDetect } from "@/lib/jobs/detect";
import { createReplayJob, findReplaySource, runReplayDetect } from "@/lib/jobs/replay";
import { createLogger, errorMessage } from "@/lib/log";
import { photoFromBuffer } from "@/lib/pipeline/photo";
import { checkJobRateLimit, clientIp } from "@/lib/rate-limit";
import { ImportError, importShopify } from "@/lib/shop/shopify";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

export const runtime = "nodejs";
export const maxDuration = 300;

const log = createLogger("api:import-shopify");

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { url?: unknown };
    if (typeof body.url !== "string" || !body.url.trim()) return NextResponse.json({ error: "Paste your store's address." }, { status: 400 });
    await checkJobRateLimit(clientIp(req.headers));
    const { photo, source } = await importShopify(body.url);
    const prepared = await photoFromBuffer(photo);

    // the same store grid again replays the finished job for free
    const replay = await findReplaySource(prepared.hash);
    let id: string;
    if (replay) {
      id = await createReplayJob(replay, "seller");
      after(() => runReplayDetect(id));
    } else {
      await checkCanStart();
      id = await createJob(prepared, "seller");
      after(() => runDetect(id, prepared).catch(() => undefined));
    }
    await supabaseAdmin().from("jobs").update({ source: source as unknown as Json }).eq("id", id);
    return NextResponse.json({ id, store: source.store.name, products: source.cells.length });
  } catch (err) {
    if (err instanceof ImportError) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof BudgetError) return NextResponse.json({ error: err.userMessage, code: err.code }, { status: 429 });
    log.error("shopify import failed", { error: errorMessage(err) });
    return NextResponse.json({ error: "We couldn't import that store. Please try again." }, { status: 500 });
  }
}
