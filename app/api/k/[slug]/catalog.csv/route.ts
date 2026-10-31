// GET /api/k/:slug/catalog.csv → the shop as a Meta product catalog feed, for Commerce Manager to fetch on a schedule.

import { NextResponse } from "next/server";
import { catalogFeed } from "@/lib/shop/catalog";
import { createLogger, errorMessage } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 120;

const log = createLogger("api:catalog");
const SLUG = /^[a-z0-9][a-z0-9-]{2,39}$/;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const feed = await catalogFeed(slug, new URL(req.url).origin);
    if (!feed) return NextResponse.json({ error: "not found" }, { status: 404 });
    return new NextResponse(feed.csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `inline; filename="${slug}-catalog.csv"`,
        "cache-control": "public, max-age=600",
      },
    });
  } catch (err) {
    log.error("catalog feed failed", { slug, error: errorMessage(err) });
    return NextResponse.json({ error: "could not build the catalog" }, { status: 500 });
  }
}
