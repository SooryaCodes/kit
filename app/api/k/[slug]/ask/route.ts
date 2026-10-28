// POST /api/k/:slug/ask { question, itemId?, visitorId } → the shop assistant's answer (Muse Wonder).

import { NextResponse } from "next/server";
import { z } from "zod";
import { BudgetError } from "@/lib/budget";
import { createLogger, errorMessage } from "@/lib/log";
import { AskLimitError, askShop } from "@/lib/shop/ask";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = createLogger("api:ask");
const Body = z.object({
  question: z.string().trim().min(2).max(300),
  itemId: z.string().uuid().nullable().optional(),
  visitorId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Type a question first." }, { status: 400 });
  try {
    return NextResponse.json(await askShop({ slug, question: body.data.question, itemId: body.data.itemId ?? null, visitorId: body.data.visitorId }));
  } catch (err) {
    if (err instanceof AskLimitError) return NextResponse.json({ error: err.message }, { status: 429 });
    if (err instanceof BudgetError) return NextResponse.json({ error: "The assistant is resting. Please ask the seller on WhatsApp." }, { status: 429 });
    log.error("ask failed", { slug, error: errorMessage(err) });
    return NextResponse.json({ error: "Couldn't answer that just now. Please ask the seller on WhatsApp." }, { status: 500 });
  }
}
