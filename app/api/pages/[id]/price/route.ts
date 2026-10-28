// POST /api/pages/:id/price { itemId } → a web-grounded price range with its sources, or { check: null }
// when fewer than two real sources were found. Needs the page's edit token in x-kit-edit.

import { NextResponse } from "next/server";
import { z } from "zod";
import { BudgetError } from "@/lib/budget";
import { createLogger, errorMessage } from "@/lib/log";
import { EditError } from "@/lib/shop/editor";
import { checkPrice } from "@/lib/shop/price";

export const runtime = "nodejs";
export const maxDuration = 120;

const log = createLogger("api:price");
const UUID = /^[0-9a-f-]{36}$/;
const Body = z.object({ itemId: z.string().uuid() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "which product?" }, { status: 400 });
  try {
    return NextResponse.json({ check: await checkPrice(id, req.headers.get("x-kit-edit"), body.data.itemId) });
  } catch (err) {
    if (err instanceof EditError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof BudgetError) return NextResponse.json({ error: err.userMessage }, { status: 429 });
    log.error("price check failed", { page: id, error: errorMessage(err) });
    return NextResponse.json({ error: "Couldn't check prices just now." }, { status: 500 });
  }
}
