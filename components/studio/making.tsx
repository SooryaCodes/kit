"use client";

// The three steps before the workspace, as one studio layout: the photo on the left, a working panel on the right.
//   Finding   the photo with a scan line; what each model is doing, step by step
//   Products  outlined products on the photo, a list to untick and rename, one Build button
//   3D        products lift into 3D on the photo as they finish; the list shows each one's state

import { View } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { cropRect, ItemSlot, PhotoStage } from "@/app/j/[id]/job-screen";
import type { JobView } from "@/lib/jobs/view";

function Layout({ photo, children, containerRef }: { photo: React.ReactNode; children: React.ReactNode; containerRef?: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={containerRef} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6">
      <div className="rounded-3xl bg-card p-2.5 ring-1 ring-paper-shade sm:p-3">{photo}</div>
      <aside className="flex flex-col gap-5 rounded-3xl bg-card p-5 ring-1 ring-paper-shade sm:p-6 lg:sticky lg:top-6">{children}</aside>
    </div>
  );
}

const FIND_STEPS = [
  { key: "uploaded", label: "Reading your photo" },
  { key: "listing", label: "Muse Spark Open lists every product" },
  { key: "segmenting", label: "SAM 3.1 cuts each one out" },
  { key: "next", label: "Then you check the list" },
];

export function Finding({ job }: { job: JobView }) {
  const at = Math.max(0, FIND_STEPS.findIndex((s) => s.key === job.status));
  return (
    <Layout
      photo={
        <PhotoStage job={job} dim={0.15}>
          <div className="kit-scan absolute inset-x-0 h-1/4" aria-hidden />
        </PhotoStage>
      }
    >
      <div>
        <h1 className="font-display text-[clamp(36px,3.2vw,48px)] leading-[0.95] text-ink" aria-live="polite">
          Finding <span className="italic">your products</span>
        </h1>
        <p className="mt-2 text-[15px] text-ink-muted">About 20 seconds.</p>
      </div>
      <ol className="flex flex-col gap-3">
        {FIND_STEPS.map((s, i) => (
          <li key={s.key} className="flex items-center gap-3 text-[15px]">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${i < at ? "bg-cobalt-500 text-white" : i === at ? "kit-breathe bg-cobalt-100 text-cobalt-700" : "bg-paper-deep text-transparent"}`}
              aria-hidden
            >
              {i < at ? "✓" : "•"}
            </span>
            <span className={i <= at ? "text-ink" : "text-ink-faint"}>{s.label}</span>
          </li>
        ))}
      </ol>
    </Layout>
  );
}

export function Confirm({ job }: { job: JobView }) {
  const [keep, setKeep] = useState<Set<number>>(() => new Set(job.items.map((i) => i.idx)));
  const [names, setNames] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (idx: number) =>
    setKeep((s) => {
      const n = new Set(s);
      if (n.has(idx)) n.delete(idx);
      else n.add(idx);
      return n;
    });

  async function build() {
    setBusy(true);
    setError(null);
    const renames = Object.fromEntries(Object.entries(names).filter(([idx, n]) => keep.has(Number(idx)) && n.trim()));
    const res = await fetch(`/api/jobs/${job.id}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keep: [...keep], renames }),
    });
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Layout
      photo={
        <PhotoStage job={job} dim={0.55}>
          {job.photo &&
            job.items.map((item) => {
              const r = cropRect(item, job.photo!);
              if (!r || !item.cropUrl) return null;
              const on = keep.has(item.idx);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.idx)}
                  aria-pressed={on}
                  aria-label={`${on ? "Leave out" : "Include"} ${names[item.idx] ?? item.name}`}
                  className="absolute transition-[opacity,transform,filter] duration-300 hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-500"
                  style={{ ...r, opacity: on ? 1 : 0.22, filter: on ? "drop-shadow(0 8px 12px rgb(40 30 20 / .25))" : "grayscale(1)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.cropUrl} alt="" className="h-full w-full object-contain" draggable={false} />
                </button>
              );
            })}
        </PhotoStage>
      }
    >
      <div>
        <h1 className="font-display text-[clamp(36px,3.2vw,48px)] leading-[0.95] text-ink">
          Found {job.items.length} <span className="italic">products</span>
        </h1>
        <p className="mt-2 text-[15px] text-ink-muted">Untick anything that isn&apos;t for sale and fix any name. You can change everything later.</p>
      </div>
      <ul className="-mx-2 flex max-h-[46svh] flex-col gap-0.5 overflow-y-auto">
        {job.items.map((item) => {
          const on = keep.has(item.idx);
          return (
            <li key={item.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-paper/70">
              <input type="checkbox" checked={on} onChange={() => toggle(item.idx)} aria-label={on ? "Leave out" : "Include"} className="size-5 shrink-0 accent-[var(--color-cobalt-500)]" />
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-paper-deep">
                {item.cropUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.cropUrl} alt="" className="max-h-[82%] max-w-[82%] object-contain" />
                )}
              </span>
              <input
                value={names[item.idx] ?? item.name}
                onChange={(e) => setNames((n) => ({ ...n, [item.idx]: e.target.value }))}
                maxLength={60}
                aria-label="Product name"
                className={`min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-1 text-[15px] outline-none focus:bg-paper ${on ? "text-ink" : "text-ink-faint line-through"}`}
              />
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={build}
          disabled={busy || keep.size === 0}
          className="kit-press h-14 rounded-full bg-cobalt-500 text-[17px] font-medium text-white hover:bg-cobalt-600 disabled:opacity-60"
        >
          {busy ? "Starting…" : `Build ${keep.size} ${keep.size === 1 ? "product" : "products"} in 3D`}
        </button>
        <p className="text-center text-[13px] text-ink-muted">SAM 3D Objects rebuilds each one. About a minute; you can leave this page.</p>
        {error && (
          <p role="alert" className="text-center text-[14px] font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    </Layout>
  );
}

export function Building({ job, done: finished }: { job: JobView; done?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const ready = job.items.filter((i) => i.status === "ready" || i.status === "fallback").length;
  const rects = useMemo(() => (job.photo ? job.items.map((i) => cropRect(i, job.photo!)) : []), [job.items, job.photo]);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = job.timings.reconstructSubmittedAt ?? Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [job.timings.reconstructSubmittedAt]);
  const all = finished || job.status === "ready";

  return (
    <>
      <Layout
        containerRef={container}
        photo={
          <PhotoStage job={job} dim={0.9}>
            {job.items.map((item, i) => (rects[i] ? <ItemSlot key={item.id} item={item} rect={rects[i]!} /> : null))}
          </PhotoStage>
        }
      >
        <div>
          <h1 className="font-display text-[clamp(36px,3.2vw,48px)] leading-[0.95] text-ink" aria-live="polite">
            {all ? (
              <>
                All {job.items.length} <span className="italic">in 3D</span>
              </>
            ) : (
              <>
                Building <span className="italic">in 3D</span>
              </>
            )}
          </h1>
          <p className="mt-2 text-[15px] tabular-nums text-ink-muted">{all ? "Opening your studio…" : `${ready} of ${job.items.length} ready · ${elapsed} s`}</p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-paper-deep" aria-hidden>
          <div className="h-full rounded-full bg-cobalt-500 transition-[width] duration-700" style={{ width: `${(ready / Math.max(1, job.items.length)) * 100}%` }} />
        </div>
        <ul className="-mx-2 flex max-h-[46svh] flex-col gap-0.5 overflow-y-auto">
          {job.items.map((item) => {
            const done = item.status === "ready" || item.status === "fallback";
            return (
              <li key={item.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-paper-deep">
                  {item.cropUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.cropUrl} alt="" className={`max-h-[82%] max-w-[82%] object-contain ${done ? "" : "kit-breathe"}`} />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{item.name}</span>
                <span className={`shrink-0 text-[13px] ${done ? "font-medium text-cobalt-700" : "text-ink-muted"}`}>{done ? "In 3D" : "Building"}</span>
              </li>
            );
          })}
        </ul>
      </Layout>
      <Canvas eventSource={container as React.RefObject<HTMLDivElement>} style={{ position: "fixed", inset: 0, pointerEvents: "none" }} dpr={[1, 2]}>
        <View.Port />
      </Canvas>
    </>
  );
}
