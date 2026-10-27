// Spend totals vs caps. Requires `Authorization: Bearer <ADMIN_TOKEN>`.

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { spendSummary } from "@/lib/budget";
import { config } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(header: string | null): boolean {
  const token = config().ADMIN_TOKEN;
  if (!token || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!authorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await spendSummary());
}
