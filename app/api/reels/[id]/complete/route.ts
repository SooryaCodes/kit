// POST /api/reels/:id/complete → confirms the uploads landed and returns the share link.

import { NextResponse } from "next/server";
import { createLogger, errorMessage } from "@/lib/log";
import { completeReel } from "@/lib/reels";

export const runtime = "nodejs";

const log = createLogger("api:reel-complete");

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await completeReel(id));
  } catch (err) {
    log.error("complete reel failed", { reel: id, error: errorMessage(err) });
    return NextResponse.json({ error: "The video didn't finish uploading. Please try again." }, { status: 500 });
  }
}
