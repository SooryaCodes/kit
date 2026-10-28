"use client";

// Anonymous pilot metrics for the owner: page views, 3D opens, AR opens, questions, order taps.
// Written straight to the events table with the anon key; row level security allows inserts for published pages only.

import { supabaseBrowser } from "../supabase/client";

export type ShopEvent = "view" | "open_3d" | "open_ar" | "ask" | "buy";

const seen = new Set<string>();

export function track(pageId: string, type: ShopEvent, itemId?: string): void {
  // one view per page load, one 3D open per product per page load
  const key = `${pageId}:${type}:${itemId ?? ""}`;
  if ((type === "view" || type === "open_3d") && seen.has(key)) return;
  seen.add(key);
  void supabaseBrowser()
    .from("events")
    .insert({ page_id: pageId, item_id: itemId ?? null, type })
    .then(({ error }) => {
      if (error) console.warn("[kit] event not recorded", error.message);
    });
}
