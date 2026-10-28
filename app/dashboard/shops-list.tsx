"use client";

// Shop pages this browser created (edit tokens live in localStorage), with links to edit and to the Reels.

import Link from "next/link";
import { useEffect, useState } from "react";
import { listShops, type SavedShop } from "@/lib/client/my-shops";

export function ShopsList() {
  const [shops, setShops] = useState<SavedShop[] | null>(null);
  useEffect(() => setShops(listShops()), []);

  if (shops === null) return null;
  if (!shops.length) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <p className="max-w-[36ch] text-lead text-ink-muted">No shop pages on this device yet. One photo of your products is all it takes.</p>
        <Link href="/new" className="kit-press rounded-full bg-cobalt-500 px-7 py-4 text-[17px] font-medium text-white hover:bg-cobalt-600">
          Make your shop link
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-10">
      <ul className="flex flex-col gap-3">
        {shops.map((s) => (
          <li key={s.pageId} className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-card px-6 py-5">
            <div className="flex flex-col">
              <span className="font-display text-[30px] leading-none text-ink">{s.title}</span>
              <span className="text-[14px] text-ink-muted">/k/{s.slug}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/k/${s.slug}`} target="_blank" className="rounded-full px-4 py-2.5 text-[15px] font-medium text-ink-muted hover:text-ink">
                View
              </Link>
              <Link href={`/j/${s.jobId}/shop`} className="rounded-full bg-ink px-5 py-2.5 text-[15px] font-medium text-white">
                Edit
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-center text-[15px] text-ink-muted">
        Looking for your videos?{" "}
        <Link href="/reels" className="font-medium text-cobalt-600 underline-offset-4 hover:underline">
          My Reels
        </Link>
      </p>
    </div>
  );
}
