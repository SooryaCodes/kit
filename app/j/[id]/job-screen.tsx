"use client";

import { PerspectiveCamera, View } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import { KitModel, StudioLights } from "@/components/three/kit-model";
import type { JobItemView, JobView } from "@/lib/jobs/view";
import { useJob } from "./use-job";

type Rect = { left: string; top: string; width: string; height: string };

/** Where an item's cutout sits on the photo, in percent (same padding as the server's cropPng). */
function cropRect(item: JobItemView, photo: { width: number; height: number }): Rect | null {
  const b = item.box;
  if (!b) return null;
  const p = Math.round(Math.max(b.right - b.left, b.bottom - b.top) * 0.06);
  const left = Math.max(0, b.left - p);
  const top = Math.max(0, b.top - p);
  const right = Math.min(photo.width, b.right + p);
  const bottom = Math.min(photo.height, b.bottom + p);
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return { left: pct(left, photo.width), top: pct(top, photo.height), width: pct(right - left, photo.width), height: pct(bottom - top, photo.height) };
}

function PhotoStage({ job, dim, children }: { job: JobView; dim: number; children?: React.ReactNode }) {
  const ratio = job.photo ? job.photo.width / job.photo.height : 4 / 3;
  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-3xl bg-paper-deep" style={{ aspectRatio: ratio, maxWidth: `min(100%, calc(68svh * ${ratio}))` }}>
      {job.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={job.photoUrl} alt="Your photo" className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700" style={{ opacity: 1 - dim }} />
      )}
      {children}
    </div>
  );
}

const WORKING_COPY: Record<string, [string, string]> = {
  uploaded: ["Reading", "your photo"],
  listing: ["Finding", "your things"],
  segmenting: ["Cutting", "them out"],
};

function Working({ job }: { job: JobView }) {
  const [a, b] = WORKING_COPY[job.status] ?? WORKING_COPY.listing!;
  return (
    <section className="flex flex-col items-center gap-8">
      <h1 className="font-display text-title" aria-live="polite">
        {a} <span className="italic">{b}</span>
      </h1>
      <PhotoStage job={job} dim={0.15}>
        <div className="kit-scan absolute inset-x-0 h-1/4" aria-hidden />
      </PhotoStage>
      <p className="text-[15px] text-ink-muted">Muse Spark lists every item, then SAM 3.1 cuts each one out. About 20 seconds.</p>
    </section>
  );
}

function Detect({ job }: { job: JobView }) {
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
    <section className="flex flex-col items-center gap-8">
      <div>
        <h1 className="font-display text-title">
          Found {job.items.length} <span className="italic">things</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lead text-ink-muted">Tap anything you don&apos;t want in your Reel. Rename items below.</p>
      </div>

      <PhotoStage job={job} dim={0.6}>
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
                aria-label={`${on ? "Remove" : "Keep"} ${names[item.idx] ?? item.name}`}
                className="absolute transition-[opacity,transform,filter] duration-300 hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-500"
                style={{ ...r, opacity: on ? 1 : 0.22, filter: on ? "drop-shadow(0 10px 14px rgb(40 30 20 / .28))" : "grayscale(1)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.cropUrl} alt="" className="h-full w-full object-contain" draggable={false} />
              </button>
            );
          })}
      </PhotoStage>

      <ul className="grid w-full grid-cols-1 gap-1.5 sm:grid-cols-2">
        {job.items.map((item) => {
          const on = keep.has(item.idx);
          return (
            <li key={item.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors ${on ? "bg-card" : "bg-card/40"}`}>
              <button
                type="button"
                onClick={() => toggle(item.idx)}
                aria-pressed={on}
                aria-label={on ? "Remove from Reel" : "Add to Reel"}
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-colors ${on ? "bg-cobalt-500 text-white" : "bg-paper-deep text-transparent"}`}
              >
                ✓
              </button>
              {item.cropUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.cropUrl} alt="" className="size-9 shrink-0 object-contain" />
              )}
              <input
                value={names[item.idx] ?? item.name}
                onChange={(e) => setNames((n) => ({ ...n, [item.idx]: e.target.value }))}
                maxLength={60}
                aria-label="Item name"
                className={`min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-1 text-[16px] outline-none focus:bg-paper ${on ? "text-ink" : "text-ink-faint line-through"}`}
              />
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-4 z-10 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={build}
          disabled={busy || keep.size === 0}
          className="rounded-full bg-cobalt-500 px-8 py-4 text-[18px] font-medium text-white transition-[transform,background-color] hover:bg-cobalt-600 active:scale-[0.97] disabled:opacity-60"
        >
          {busy ? "Starting…" : `Build ${keep.size} ${keep.size === 1 ? "item" : "items"} in 3D`}
        </button>
        {error && (
          <p role="alert" className="text-[15px] font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

/** Grows the model in from nothing when it first appears. */
function PopIn({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    t.current = Math.min(1, t.current + dt / 0.7);
    const e = 1 - Math.pow(1 - t.current, 3);
    ref.current.scale.setScalar(e);
    ref.current.rotation.y += dt * 0.35;
  });
  return (
    <group ref={ref} scale={0}>
      {children}
    </group>
  );
}

function ItemSlot({ item, rect }: { item: JobItemView; rect: Rect }) {
  const ready = item.status === "ready" && item.glbUrl;
  return (
    <div className="absolute" style={rect}>
      {item.cropUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.cropUrl}
          alt={item.name}
          className={`h-full w-full object-contain transition-all duration-700 ${ready ? "-translate-y-3 scale-110 opacity-0" : item.status === "fallback" ? "opacity-100" : "kit-breathe opacity-90"}`}
        />
      )}
      {ready && (
        <View className="absolute -inset-[15%]">
          <PerspectiveCamera makeDefault position={[0, 1.5, 1.25]} fov={38} onUpdate={(c) => c.lookAt(0, 0, 0)} />
          <StudioLights />
          <Suspense fallback={null}>
            {/* models are normalised to 1 unit, so a fixed camera frames them; Bounds would measure the scale-0 pop-in */}
            <PopIn>
              <KitModel url={item.glbUrl!} size={0.85} />
            </PopIn>
          </Suspense>
        </View>
      )}
    </div>
  );
}

function Build({ job }: { job: JobView }) {
  const container = useRef<HTMLDivElement>(null!);
  const done = job.items.filter((i) => i.status === "ready" || i.status === "fallback").length;
  const all = job.status === "ready";
  const rects = useMemo(() => (job.photo ? job.items.map((i) => cropRect(i, job.photo!)) : []), [job.items, job.photo]);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = job.timings.reconstructSubmittedAt ?? Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [job.timings.reconstructSubmittedAt]);

  return (
    <section ref={container} className="flex flex-col items-center gap-8">
      <div>
        <h1 className="font-display text-title" aria-live="polite">
          {all ? (
            <>
              Your kit, <span className="italic">in 3D</span>
            </>
          ) : (
            <>
              Building <span className="italic">in 3D</span>
            </>
          )}
        </h1>
        <p className="mt-4 text-lead text-ink-muted">
          {all ? `${done} items rebuilt from one photo.` : `${done} of ${job.items.length} ready · ${elapsed}s`}
        </p>
      </div>

      <PhotoStage job={job} dim={0.9}>
        {job.items.map((item, i) => (rects[i] ? <ItemSlot key={item.id} item={item} rect={rects[i]!} /> : null))}
      </PhotoStage>

      <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-paper-deep" aria-hidden>
        <div className="h-full rounded-full bg-cobalt-500 transition-[width] duration-700" style={{ width: `${(done / Math.max(1, job.items.length)) * 100}%` }} />
      </div>

      {all ? (
        <div className="flex flex-col items-center gap-2">
          <Link href={`/j/${job.id}/shop`} className="rounded-full bg-cobalt-500 px-8 py-4 text-[18px] font-medium text-white transition-[transform,background-color] hover:bg-cobalt-600 active:scale-[0.97]">
            Make your shop link
          </Link>
          <Link href={`/j/${job.id}/studio`} className="rounded-full px-5 py-2.5 text-[15px] font-medium text-ink-muted transition-colors hover:text-ink">
            Or make a Reel
          </Link>
        </div>
      ) : (
        <p className="max-w-md text-[15px] text-ink-muted">
          SAM 3D Objects rebuilds each item as a textured 3D model. They appear one by one as they finish. You can leave this page; your products keep building.
        </p>
      )}

      <Canvas eventSource={container} className="!pointer-events-none !fixed !inset-0" dpr={[1, 2]}>
        <View.Port />
      </Canvas>
    </section>
  );
}

export function JobScreen({ id }: { id: string }) {
  const { job, error } = useJob(id);

  if (!job) {
    return <p className="py-32 text-center text-lead text-ink-muted">{error ?? "Loading your Reel…"}</p>;
  }
  if (job.status === "failed" || job.status === "budget_exceeded") {
    return (
      <section className="flex flex-col items-center gap-6 py-16">
        <h1 className="font-display text-title">
          That didn&apos;t <span className="italic">work</span>
        </h1>
        <p className="max-w-md text-lead text-ink-muted">{job.userMessage ?? "Something went wrong while building this Reel."}</p>
        <Link href="/new" className="rounded-full bg-cobalt-500 px-7 py-4 text-[17px] font-medium text-white transition-colors hover:bg-cobalt-600">
          Try another photo
        </Link>
      </section>
    );
  }
  if (job.status === "awaiting_confirm") return <Detect job={job} />;
  if (job.status === "reconstructing" || job.status === "ready") return <Build job={job} />;
  return <Working job={job} />;
}
