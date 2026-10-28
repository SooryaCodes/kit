// GET /api/jobs/summary?ids=a,b,c → cards for My Reels (ids come from this browser's local list).

import { NextResponse } from "next/server";
import { summarise } from "@/lib/jobs/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => UUID.test(id))
    .slice(0, 50);
  return NextResponse.json(await summarise(ids), { headers: { "cache-control": "no-store" } });
}
