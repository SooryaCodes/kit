// POST /api/jobs/:id/reels { title, preset, settings } → reel row + one-time upload slots for the MP4 and cover.

import { NextResponse } from "next/server";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { createLogger, errorMessage } from "@/lib/log";
import { createReel } from "@/lib/reels";

export const runtime = "nodejs";

const log = createLogger("api:reels");
const Body = z.object({
  title: z.string().max(80),
  preset: z.string().max(20),
  settings: z.record(z.string(), z.unknown()),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json(await createReel(id, body.data.settings as Json, body.data.title, body.data.preset));
  } catch (err) {
    log.error("create reel failed", { job: id, error: errorMessage(err) });
    return NextResponse.json({ error: "We couldn't save this Reel. Please try again." }, { status: 500 });
  }
}
