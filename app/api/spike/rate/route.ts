// Dev-only: stores a quality rating for one spike item in public/spike/ratings.json.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({ key: z.string().regex(/^[\w-]+\/\d+$/), quality: z.enum(["good", "rough", "bad"]) });
const FILE = path.join(process.cwd(), "public", "spike", "ratings.json");

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  let ratings: Record<string, string> = {};
  try {
    ratings = JSON.parse(await readFile(FILE, "utf8")) as Record<string, string>;
  } catch {
    // first rating
  }
  ratings[body.data.key] = body.data.quality;
  await writeFile(FILE, JSON.stringify(ratings, null, 2));
  return NextResponse.json({ ok: true });
}
