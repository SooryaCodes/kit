// POST /api/jobs/:id/confirm { keep: number[], renames?: { [idx]: name } } → submits the 3D jobs.

import { after, NextResponse } from "next/server";
import { z } from "zod";
import { BudgetError } from "@/lib/budget";
import { submitReconstruction } from "@/lib/jobs/reconstruct";
import { confirmReplay, replaySourceOf, runReplayBuild } from "@/lib/jobs/replay";
import { createLogger, errorMessage } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 120;

const log = createLogger("api:confirm");
const Body = z.object({
  keep: z.array(z.number().int().nonnegative()).min(1).max(16),
  renames: z.record(z.string(), z.string().max(60)).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Pick at least one item." }, { status: 400 });
  try {
    const renames = Object.fromEntries(Object.entries(body.data.renames ?? {}).map(([k, v]) => [Number(k), v]));
    if (await replaySourceOf(id)) {
      const result = await confirmReplay(id, body.data.keep, renames);
      after(() => runReplayBuild(id));
      return NextResponse.json({ mode: "fast", ...result });
    }
    const result = await submitReconstruction(id, body.data.keep, { renames });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BudgetError) return NextResponse.json({ error: err.userMessage, code: err.code }, { status: 429 });
    log.error("confirm failed", { job: id, error: errorMessage(err) });
    return NextResponse.json({ error: "We couldn't start building in 3D. Please try again." }, { status: 500 });
  }
}
