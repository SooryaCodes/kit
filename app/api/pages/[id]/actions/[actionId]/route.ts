// POST /api/pages/:id/actions/:actionId { decision: "approve" | "dismiss" } → applies or dismisses one suggestion.

import { NextResponse } from "next/server";
import { z } from "zod";
import { BudgetError } from "@/lib/budget";
import { createLogger, errorMessage } from "@/lib/log";
import { EditError } from "@/lib/shop/editor";
import { decideAction } from "@/lib/shop/manager";

export const runtime = "nodejs";
export const maxDuration = 120;

const log = createLogger("api:actions");
const UUID = /^[0-9a-f-]{36}$/;
const Body = z.object({ decision: z.enum(["approve", "dismiss"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string; actionId: string }> }) {
  const { id, actionId } = await params;
  if (!UUID.test(id) || !UUID.test(actionId)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "approve or dismiss" }, { status: 400 });
  try {
    return NextResponse.json({ status: await decideAction(id, req.headers.get("x-kit-edit"), actionId, body.data.decision) });
  } catch (err) {
    if (err instanceof EditError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof BudgetError) return NextResponse.json({ error: err.userMessage }, { status: 429 });
    log.error("decision failed", { page: id, action: actionId, error: errorMessage(err) });
    return NextResponse.json({ error: "Couldn't apply that. Please try again." }, { status: 500 });
  }
}
