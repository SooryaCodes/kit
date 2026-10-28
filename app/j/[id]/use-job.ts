"use client";

// Live job state: fetches the job view, refetches on every Realtime change to its row or items,
// and while 3D is building asks the server to check fal (covers local dev and lost webhooks).

import { useCallback, useEffect, useRef, useState } from "react";
import type { JobView } from "@/lib/jobs/view";
import { supabaseBrowser } from "@/lib/supabase/client";

export function useJob(id: string) {
  const [job, setJob] = useState<JobView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
      if (res.status === 404) return setError("This Reel doesn't exist.");
      if (!res.ok) throw new Error(`load failed ${res.status}`);
      setJob((await res.json()) as JobView);
    } catch {
      setError("We lost the connection. Retrying…");
    }
  }, [id]);

  // coalesce bursts of Realtime events into one refetch
  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(), 250);
  }, [load]);

  useEffect(() => {
    void load();
    const db = supabaseBrowser();
    const channel = db
      .channel(`job-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `job_id=eq.${id}` }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${id}` }, refresh)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh(); // catch anything that changed before the listener attached
      });
    return () => {
      void db.removeChannel(channel);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id, load, refresh]);

  // early stages: a slow poll in case Realtime is blocked on this network
  const status = job?.status;
  useEffect(() => {
    if (!status || status === "ready" || status === "failed" || status === "budget_exceeded" || status === "awaiting_confirm") return;
    const building = status === "reconstructing";
    const t = setInterval(async () => {
      if (building) await fetch(`/api/jobs/${id}/sync`, { method: "POST" }).catch(() => undefined);
      void load();
    }, building ? 5000 : 3000);
    return () => clearInterval(t);
  }, [status, id, load]);

  return { job, error, reload: load };
}
