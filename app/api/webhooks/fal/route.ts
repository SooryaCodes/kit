// POST /api/webhooks/fal: fal calls this when a SAM 3D Objects request finishes.
// Verified with fal's Ed25519 signature; answers 200 fast and processes after responding.

import { after, NextResponse } from "next/server";
import { verifyFalWebhook } from "@/lib/fal-webhook";
import type { Sam3dObjectsOutput } from "@/lib/fal";
import { finishRequest } from "@/lib/jobs/reconstruct";
import { createLogger, errorMessage } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 300;

const log = createLogger("api:fal-webhook");

interface FalWebhook {
  request_id: string;
  status: "OK" | "ERROR";
  error?: string;
  payload?: Sam3dObjectsOutput | null;
  payload_error?: string;
}

export async function POST(req: Request) {
  const body = Buffer.from(await req.arrayBuffer());
  if (!(await verifyFalWebhook(req.headers, body))) {
    log.warn("rejected webhook with a bad signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let event: FalWebhook;
  try {
    event = JSON.parse(body.toString("utf8")) as FalWebhook;
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  log.info("webhook", { requestId: event.request_id, status: event.status });
  after(async () => {
    try {
      // a payload that could not be serialised is fetched from the queue instead (output undefined)
      const failure = event.status === "ERROR" ? (event.error ?? "fal error") : undefined;
      await finishRequest(event.request_id, event.payload ?? undefined, failure);
    } catch (err) {
      log.error("webhook processing failed", { requestId: event.request_id, error: errorMessage(err) });
    }
  });
  return NextResponse.json({ ok: true });
}
