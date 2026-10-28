"use client";

import { Bounds, OrbitControls, PerspectiveCamera, useGLTF, View } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Quality, Ratings, SpikeItem, SpikePhoto, SpikeReport } from "./types";

type Variant = "optimized" | "raw" | "single";

function Model({ url, unlit }: { url: string; unlit: boolean }) {
  const { scene } = useGLTF(url);
  // useGLTF caches by URL; a three.js object has one parent, so each view needs its own copy.
  // Unlit shows the photo-baked texture as captured, without our lights on top.
  const copy = useMemo(() => {
    const root = scene.clone(true);
    if (unlit) {
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const src = mesh.material as THREE.MeshStandardMaterial;
        mesh.material = new THREE.MeshBasicMaterial({ map: src.map ?? null, color: src.map ? 0xffffff : src.color, side: THREE.DoubleSide });
      });
    }
    return root;
  }, [scene, unlit]);
  return <primitive object={copy} />;
}

function ItemView({ item, variant, spin, unlit }: { item: SpikeItem; variant: Variant; spin: boolean; unlit: boolean }) {
  const url = variant === "raw" ? item.glbRaw : variant === "single" ? (item.glbPerItem ?? item.glb) : item.glb;
  if (!url) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg bg-neutral-100 px-3 text-center text-xs text-red-700">
        {item.error ?? "no GLB"}
      </div>
    );
  }
  return (
    <View className="h-56 w-full rounded-lg bg-gradient-to-b from-white to-blue-50">
      {/* SAM 3D keeps the photo's camera frame: for top-down shots the photographed face points up */}
      <PerspectiveCamera makeDefault position={[0, 2.4, 1.6]} fov={35} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.25}>
          <Model url={url} unlit={unlit} />
        </Bounds>
      </Suspense>
      <OrbitControls makeDefault autoRotate={spin} autoRotateSpeed={2} />
    </View>
  );
}

const QUALITY_STYLE: Record<Quality, string> = {
  good: "bg-blue-600 text-white",
  rough: "bg-blue-300 text-blue-950",
  bad: "bg-blue-950 text-white",
};

function ItemCard(props: {
  photo: SpikePhoto;
  item: SpikeItem;
  variant: Variant;
  spin: boolean;
  unlit: boolean;
  rating?: Quality;
  onRate: (q: Quality) => void;
}) {
  const { item, rating } = props;
  const kb = (b?: number) => (b ? `${Math.round(b / 1024)} KB` : "?");
  return (
    <div className="rounded-xl border border-neutral-200 bg-white/90 p-2 shadow-sm">
      <ItemView item={item} variant={props.variant} spin={props.spin} unlit={props.unlit} />
      <div className="mt-2 flex gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.crop} alt="" className="h-14 w-14 shrink-0 rounded bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:10px_10px] object-contain" />
        <div className="min-w-0 text-xs leading-tight">
          <div className="truncate text-sm font-medium">
            #{item.index} {item.name}
          </div>
          <div className="truncate text-neutral-500">&ldquo;{item.phrase}&rdquo; · {item.category}</div>
          <div className="text-neutral-500">
            {item.source}
            {item.confidence !== null ? ` · c=${item.confidence}` : ""} · {item.areaPct}%{item.flat ? " · flat" : ""}
            {item.partial ? " · partial" : ""}
          </div>
          <div className="text-neutral-400">
            {item.trianglesAfter ?? "?"} tris · {kb(item.bytesBefore)} → {kb(item.bytesAfter)}
            {item.reconstructMs ? ` · ${(item.reconstructMs / 1000).toFixed(1)}s` : ""}
          </div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {(["good", "rough", "bad"] as const).map((q) => (
          <button
            key={q}
            onClick={() => props.onRate(q)}
            className={`rounded px-2 py-1 text-xs capitalize ${rating === q ? QUALITY_STYLE[q] : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function PhotoSection(props: { photo: SpikePhoto; variant: Variant; spin: boolean; unlit: boolean; ratings: Ratings; onRate: (key: string, q: Quality) => void }) {
  const { photo, ratings } = props;
  const rated = photo.items.filter((i) => ratings[`${photo.slug}/${i.index}`]);
  const good = rated.filter((i) => ratings[`${photo.slug}/${i.index}`] === "good").length;
  const glbs = photo.items.filter((i) => i.glb).length;
  const secs = (ms?: number) => (ms ? `${(ms / 1000).toFixed(1)}s` : "–");
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.photo} alt={photo.file} className="w-full rounded-xl border border-neutral-200 shadow-sm" />
          <h2 className="mt-3 text-lg font-semibold">{photo.file}</h2>
          <dl className="mt-1 grid grid-cols-2 gap-x-3 text-sm text-neutral-600">
            <dt>Listed / kept</dt>
            <dd>
              {photo.lister.listed} / {photo.items.length}
            </dd>
            <dt>GLBs</dt>
            <dd>{glbs}</dd>
            <dt>Rated good</dt>
            <dd>{rated.length ? `${good}/${rated.length} (${Math.round((good / rated.length) * 100)}%)` : "not rated"}</dd>
            <dt>List / segment / 3D</dt>
            <dd>
              {secs(photo.steps.list?.ms)} / {secs(photo.steps.segment?.ms)} / {secs(photo.steps.reconstruct?.ms)}
            </dd>
            <dt>Total</dt>
            <dd>
              {secs(photo.totalMs)} · ${photo.totalUsd.toFixed(3)}
            </dd>
            <dt>Lister</dt>
            <dd className="truncate">{photo.lister.model}</dd>
          </dl>
          {photo.error && <p className="mt-2 text-sm text-red-700">{photo.error}</p>}
          {(photo.notes.length > 0 || photo.dropped.length > 0) && (
            <details className="mt-2 text-xs text-neutral-500">
              <summary className="cursor-pointer">Notes ({photo.notes.length + photo.dropped.length})</summary>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {photo.notes.map((n, i) => (
                  <li key={`n${i}`}>{n}</li>
                ))}
                {photo.dropped.map((d, i) => (
                  <li key={`d${i}`}>
                    dropped {d.name}: {d.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {photo.items.map((item) => (
            <ItemCard
              key={item.index}
              photo={photo}
              item={item}
              variant={props.variant}
              spin={props.spin}
              unlit={props.unlit}
              rating={ratings[`${photo.slug}/${item.index}`]}
              onRate={(q) => props.onRate(`${photo.slug}/${item.index}`, q)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function SpikeViewer({ report, initialRatings }: { report: SpikeReport; initialRatings: Ratings }) {
  const container = useRef<HTMLDivElement>(null!);
  const [variant, setVariant] = useState<Variant>("optimized");
  const [spin, setSpin] = useState(true);
  const [unlit, setUnlit] = useState(true);
  const [ratings, setRatings] = useState<Ratings>(initialRatings);
  const s = report.summary;
  const allRated = Object.values(ratings);
  const goodPct = allRated.length ? Math.round((allRated.filter((r) => r === "good").length / allRated.length) * 100) : null;

  const rate = async (key: string, quality: Quality) => {
    setRatings((r) => ({ ...r, [key]: quality }));
    await fetch("/api/spike/rate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, quality }) });
  };

  return (
    <div
      ref={container}
      className="relative min-h-screen bg-white bg-[linear-gradient(to_right,rgb(37_99_235/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(37_99_235/0.06)_1px,transparent_1px)] bg-[size:32px_32px] text-neutral-900"
    >
      <header className="mx-auto max-w-3xl px-4 pt-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Spike results</h1>
        <p className="mt-2 text-neutral-600">
          {s.photos} photos · {s.items} items · {s.glbs} GLBs · ${s.totalUsd.toFixed(3)} total · ${s.usdPerItem.toFixed(4)}/item · {s.avgSecondsPerPhoto}s/photo
          {goodPct !== null ? ` · ${goodPct}% rated good (${allRated.length} rated)` : ""}
        </p>
        <p className="mt-1 text-xs text-neutral-400">Run {s.runAt.slice(0, 16).replace("T", " ")} UTC</p>
        <div className="mt-4 inline-flex gap-1 rounded-lg border border-neutral-200 bg-white p-1 text-sm">
          {(["optimized", "raw", "single"] as const).map((v) => (
            <button key={v} onClick={() => setVariant(v)} className={`rounded-md px-3 py-1 capitalize ${variant === v ? "bg-blue-600 text-white" : "text-neutral-600"}`}>
              {v === "single" ? "per-item call" : v}
            </button>
          ))}
          <button onClick={() => setSpin((x) => !x)} className={`rounded-md px-3 py-1 ${spin ? "bg-blue-100 text-blue-900" : "text-neutral-600"}`}>
            spin
          </button>
          <button onClick={() => setUnlit((x) => !x)} className={`rounded-md px-3 py-1 ${unlit ? "bg-blue-100 text-blue-900" : "text-neutral-600"}`}>
            unlit
          </button>
        </div>
      </header>

      {report.reports.map((photo) => (
        <PhotoSection key={photo.slug} photo={photo} variant={variant} spin={spin} unlit={unlit} ratings={ratings} onRate={rate} />
      ))}

      <Canvas eventSource={container} className="!pointer-events-none !fixed !inset-0" camera={{ position: [0, 0, 3], fov: 40 }}>
        <View.Port />
      </Canvas>
    </div>
  );
}
