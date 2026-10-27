"use client";

// Live item list for one job: initial fetch, then Supabase Realtime changes on items.

import { useEffect, useState } from "react";
import { supabaseBrowser } from "./client";

export interface JobItem {
  id: string;
  job_id: string;
  idx: number;
  name: string;
  status: "pending" | "segmented" | "reconstructing" | "ready" | "fallback" | "failed";
  crop_url: string | null;
  glb_url: string | null;
  confidence: number | null;
  [key: string]: unknown;
}

export function useJobItems(jobId: string): { items: JobItem[]; error: string | null } {
  const [items, setItems] = useState<JobItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = supabaseBrowser();
    let alive = true;

    const upsert = (row: JobItem) =>
      setItems((prev) => {
        const next = prev.filter((i) => i.id !== row.id);
        next.push(row);
        return next.sort((a, b) => a.idx - b.idx);
      });

    const channel = db
      .channel(`job-items-${jobId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `job_id=eq.${jobId}` }, (payload) => {
        if (payload.eventType === "DELETE") setItems((prev) => prev.filter((i) => i.id !== (payload.old as JobItem).id));
        else upsert(payload.new as JobItem);
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setError(`realtime ${status.toLowerCase()}`);
      });

    // fetch after subscribing so no change between the two is missed
    db.from("items")
      .select("*")
      .eq("job_id", jobId)
      .order("idx")
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e.message);
        else for (const row of (data ?? []) as JobItem[]) upsert(row);
      });

    return () => {
      alive = false;
      void db.removeChannel(channel);
    };
  }, [jobId]);

  return { items, error };
}
