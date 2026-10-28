"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { JobSummary } from "@/lib/jobs/summary";
import { forgetReel, listReels } from "@/lib/client/my-reels";

const STATUS: Record<string, string> = {
  uploaded: "Starting",
  listing: "Finding items",
  segmenting: "Cutting out",
  awaiting_confirm: "Waiting for you",
  reconstructing: "Building in 3D",
  ready: "Ready to edit",
  failed: "Didn't work",
  budget_exceeded: "Paused",
};

function Thumbs({ thumbs }: { thumbs: string[] }) {
  const spots = [
    { left: "8%", top: "18%", w: "48%", r: -6 },
    { left: "52%", top: "12%", w: "34%", r: 9 },
    { left: "30%", top: "52%", w: "30%", r: -12 },
    { left: "62%", top: "56%", w: "26%", r: 6 },
  ];
  return (
    <>
      {thumbs.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" className="shadow-object absolute" style={{ left: spots[i]!.left, top: spots[i]!.top, width: spots[i]!.w, transform: `rotate(${spots[i]!.r}deg)` }} />
      ))}
    </>
  );
}

export function ReelsList() {
  const [cards, setCards] = useState<JobSummary[] | null>(null);

  useEffect(() => {
    const saved = listReels();
    if (!saved.length) return setCards([]);
    fetch(`/api/jobs/summary?ids=${saved.map((r) => r.id).join(",")}`)
      .then((r) => r.json() as Promise<JobSummary[]>)
      .then(setCards)
      .catch(() => setCards([]));
  }, []);

  if (cards === null) return <p className="py-24 text-center text-lead text-ink-muted">Loading your Reels…</p>;

  if (!cards.length) {
    return (
      <div className="flex flex-col items-center gap-6 py-20 text-center">
        <p className="font-display text-[clamp(36px,3.4vw,56px)] leading-none text-ink">
          Nothing here <span className="italic">yet</span>
        </p>
        <p className="max-w-md text-lead text-ink-muted">Reels you make on this device show up here. No account needed.</p>
        <Link href="/new" className="rounded-full bg-cobalt-500 px-7 py-4 text-[17px] font-medium text-white transition-colors hover:bg-cobalt-600">
          Make your first Reel
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => {
        const href = c.status === "ready" ? `/j/${c.id}/studio` : `/j/${c.id}`;
        return (
          <li key={c.id} className="group relative">
            <Link href={href} className="block rounded-3xl bg-card p-2.5 transition-transform duration-300 hover:-translate-y-1">
              <span className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-paper-deep/70">
                {c.reel?.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.reel.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Thumbs thumbs={c.thumbs} />
                )}
              </span>
              <span className="flex items-baseline justify-between gap-3 px-2 pb-1.5 pt-3.5">
                <span className="font-display text-[26px] leading-none text-ink">{c.reel?.title ?? c.template}</span>
                <span className={`shrink-0 text-[13px] font-medium ${c.status === "ready" ? "text-cobalt-600" : "text-ink-muted"}`}>{STATUS[c.status] ?? c.status}</span>
              </span>
              <span className="block px-2 pb-1 text-[14px] text-ink-faint">
                {c.items} items · {new Date(c.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </span>
            </Link>
            <div className="absolute right-5 top-5 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              {c.reel && (
                <Link href={`/s/${c.reel.slug}`} className="rounded-full bg-card/95 px-3 py-1.5 text-[13px] font-medium text-ink">
                  Share page
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  forgetReel(c.id);
                  setCards((all) => all?.filter((x) => x.id !== c.id) ?? null);
                }}
                className="rounded-full bg-card/95 px-3 py-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
              >
                Remove
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
