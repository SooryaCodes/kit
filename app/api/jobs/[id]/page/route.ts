// POST /api/jobs/:id/page → creates the draft shop page for a finished job (once) and returns its edit token.
// GET  /api/jobs/:id/page → { pageId, slug } when a page already exists (never the token).

import { NextResponse } from "next/server";
import { BudgetError } from "@/lib/budget";
import { createLogger, errorMessage } from "@/lib/log";
import { createDraftPage, EditError } from "@/lib/shop/editor";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const log = createLogger("api:page");
const UUID = /^[0-9a-f-]{36}$/;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data } = await supabaseAdmin().from("pages").select("id, slug").eq("job_id", id).maybeSingle();
  return NextResponse.json(data ? { pageId: data.id, slug: data.slug } : {});
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    return NextResponse.json(await createDraftPage(id));
  } catch (err) {
    if (err instanceof EditError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof BudgetError) return NextResponse.json({ error: err.userMessage }, { status: 429 });
    log.error("create page failed", { job: id, error: errorMessage(err) });
    return NextResponse.json({ error: "We couldn't create your shop page. Please try again." }, { status: 500 });
  }
}
