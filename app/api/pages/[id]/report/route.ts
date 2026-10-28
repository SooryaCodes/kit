// GET  /api/pages/:id/report → the latest Shop Manager report with its suggestions, plus live numbers.
// POST /api/pages/:id/report → write a new report now (Muse Wonder reads the numbers and questions).
// Both need the page's edit token in the x-kit-edit header.

import { NextResponse } from "next/server";
import { BudgetError } from "@/lib/budget";
import { createLogger, errorMessage } from "@/lib/log";
import { EditError } from "@/lib/shop/editor";
import { latestReport, runMorningReport, shopMetrics } from "@/lib/shop/manager";
import { checkToken } from "@/lib/shop/editor";

export const runtime = "nodejs";
export const maxDuration = 300;

const log = createLogger("api:report");
const UUID = /^[0-9a-f-]{36}$/;

function fail(err: unknown, page: string) {
  if (err instanceof EditError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof BudgetError) return NextResponse.json({ error: err.userMessage }, { status: 429 });
  log.error("report request failed", { page, error: errorMessage(err) });
  return NextResponse.json({ error: "The Shop Manager couldn't finish. Please try again." }, { status: 500 });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const token = req.headers.get("x-kit-edit");
    await checkToken(id, token);
    const [report, metrics] = await Promise.all([latestReport(id, token), shopMetrics(id, 7)]);
    return NextResponse.json({ report, metrics });
  } catch (err) {
    return fail(err, id);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const report = await runMorningReport(id, req.headers.get("x-kit-edit"));
    return NextResponse.json({ report, metrics: report.metrics });
  } catch (err) {
    return fail(err, id);
  }
}
