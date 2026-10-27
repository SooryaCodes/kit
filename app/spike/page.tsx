// Dev-only viewer for the last spike run: every generated GLB next to its source photo.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { SpikeViewer } from "./spike-viewer";
import type { Ratings, SpikeReport } from "./types";

export const dynamic = "force-dynamic";

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "public", "spike", file), "utf8")) as T;
  } catch {
    return null;
  }
}

export default async function SpikePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const report = await readJson<SpikeReport>("report.json");
  const ratings = (await readJson<Ratings>("ratings.json")) ?? {};
  if (!report) {
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">No spike run yet</h1>
        <p className="mt-3 text-neutral-500">
          Run <code className="rounded bg-neutral-100 px-1.5 py-0.5">pnpm spike</code> and reload.
        </p>
      </main>
    );
  }
  return <SpikeViewer report={report} initialRatings={ratings} />;
}
