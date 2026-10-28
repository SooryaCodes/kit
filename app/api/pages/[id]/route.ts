// GET   /api/pages/:id → the page and all its products, for the editor.
// PATCH /api/pages/:id → save edits; a published page also gets its AR models and styled photos ready in the background.
// Both need the page's edit token in the x-kit-edit header.

import { after, NextResponse } from "next/server";
import { createLogger, errorMessage } from "@/lib/log";
import { EditError, getEditorPage, PagePatch, preparePage, updatePage } from "@/lib/shop/editor";

export const runtime = "nodejs";
export const maxDuration = 120;

const log = createLogger("api:pages");
const UUID = /^[0-9a-f-]{36}$/;

function fail(err: unknown, page: string) {
  if (err instanceof EditError) return NextResponse.json({ error: err.message }, { status: err.status });
  log.error("page request failed", { page, error: errorMessage(err) });
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    return NextResponse.json(await getEditorPage(id, req.headers.get("x-kit-edit")));
  } catch (err) {
    return fail(err, id);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = PagePatch.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Check the highlighted fields." }, { status: 400 });
  try {
    const page = await updatePage(id, req.headers.get("x-kit-edit"), body.data);
    if (page.published) after(() => preparePage(id));
    return NextResponse.json(page);
  } catch (err) {
    return fail(err, id);
  }
}
