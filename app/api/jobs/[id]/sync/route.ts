// POST /api/jobs/:id/sync → checks fal for finished 3D requests of this job. Free; safe to call often.

import { NextResponse } from "next/server";
import { syncJob } from "@/lib/jobs/reconstruct";
import { createLogger, errorMessage } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 300;

const log = createLogger("api:sync");

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await syncJob(id));
  } catch (err) {
    log.error("sync failed", { job: id, error: errorMessage(err) });
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}
