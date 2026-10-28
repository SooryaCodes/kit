// POST /api/jobs: multipart { photo, template } → creates the job and starts detection after responding.
// A photo that already has a finished job replays it instead: no model calls, no caps.

import { after, NextResponse } from "next/server";
import { BudgetError } from "@/lib/budget";
import { checkCanStart, createJob, runDetect } from "@/lib/jobs/detect";
import { createReplayJob, findReplaySource, runReplayDetect } from "@/lib/jobs/replay";
import { createLogger, errorMessage } from "@/lib/log";
import { photoFromBuffer } from "@/lib/pipeline/photo";
import { checkJobRateLimit, clientIp } from "@/lib/rate-limit";
import { isTemplateId } from "@/lib/templates";

export const runtime = "nodejs";
export const maxDuration = 300;

const log = createLogger("api:jobs");
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const photo = form.get("photo");
    const template = form.get("template");
    if (!(photo instanceof File) || !photo.size) return NextResponse.json({ error: "Add a photo first." }, { status: 400 });
    if (photo.size > MAX_BYTES) return NextResponse.json({ error: "That photo is over 15 MB. Try a smaller one." }, { status: 413 });
    if (!photo.type.startsWith("image/")) return NextResponse.json({ error: "That file isn't a photo." }, { status: 415 });
    if (!isTemplateId(template)) return NextResponse.json({ error: "Pick a template." }, { status: 400 });

    const prepared = await photoFromBuffer(Buffer.from(await photo.arrayBuffer()));
    // a photo Kit has already finished (the sample bag, or the same picture again) replays for free
    const source = await findReplaySource(prepared.hash);
    if (source) {
      const id = await createReplayJob(source, template);
      after(() => runReplayDetect(id));
      return NextResponse.json({ id });
    }

    await checkCanStart();
    await checkJobRateLimit(clientIp(req.headers));
    const id = await createJob(prepared, template);
    after(() => runDetect(id, prepared).catch(() => undefined));
    return NextResponse.json({ id });
  } catch (err) {
    if (err instanceof BudgetError) return NextResponse.json({ error: err.userMessage, code: err.code }, { status: 429 });
    log.error("create job failed", { error: errorMessage(err) });
    return NextResponse.json({ error: "We couldn't start this Reel. Please try again." }, { status: 500 });
  }
}
