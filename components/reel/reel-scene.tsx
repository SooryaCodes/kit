"use client";

// The Reel itself, rendered in WebGL so the exported MP4 matches the preview frame for frame.
// Time comes from `timeRef` (seconds). The preview advances it with the clock; export steps it per frame.
//   fly-in   items drop into their places from the photo, one after another
//   orbit    items sit as in the photo while the camera circles them
//   knolling items start as in the photo, then tidy into a grid

import { ContactShadows, PerspectiveCamera, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { KitModel, StudioLights } from "@/components/three/kit-model";
import type { JobItemView } from "@/lib/jobs/view";
import { DURATION_S, inkFor, type ReelSettings } from "./reel-settings";

const DISPLAY = "/fonts/InstrumentSerif-Regular.woff";
const TEXT = "/fonts/HankenGrotesk-Medium.woff";

export interface ReelItem {
  item: JobItemView;
  label: string;
  /** layout in scene units: as in the photo, and in the tidy grid */
  photo: THREE.Vector3;
  grid: THREE.Vector3;
  size: number;
}

const easeOutBack = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Positions for every visible item. The frame is ~2.6 units wide (9:16) or ~4 (1:1). */
export function layoutItems(items: JobItemView[], photo: { width: number; height: number }, settings: ReelSettings): ReelItem[] {
  const shown = items.filter((i) => i.glbUrl && !settings.hidden.includes(i.idx));
  const width = settings.format === "9:16" ? 2.5 : 3.6;
  const depth = (width * photo.height) / photo.width;
  const maxArea = Math.max(...shown.map((i) => i.box?.areaPct ?? 1), 1);

  const cols = shown.length <= 4 ? 2 : 3;
  const rows = Math.ceil(shown.length / cols);
  const cell = Math.min(width / cols, 3.6 / rows);

  return shown.map((item, n) => {
    const b = item.box ?? { left: 0, top: 0, right: photo.width, bottom: photo.height };
    const cx = ((b.left + b.right) / 2 / photo.width - 0.5) * width;
    const cz = ((b.top + b.bottom) / 2 / photo.height - 0.5) * depth;
    // relative size from the share of the photo each item covers (area → length: square root)
    const size = 0.35 + 0.75 * Math.sqrt((item.box?.areaPct ?? maxArea) / maxArea);
    const col = n % cols;
    const row = Math.floor(n / cols);
    const grid = new THREE.Vector3((col - (cols - 1) / 2) * cell, 0, (row - (rows - 1) / 2) * cell + 0.2);
    const base = settings.names[item.idx] ?? item.name;
    const label =
      settings.labels === "name-brand" && item.brand ? `${base} · ${item.brand}` : settings.labels === "name-price" && item.price ? `${base} · ${item.currency ?? "₹"}${item.price}` : base;
    return { item, label, photo: new THREE.Vector3(cx, 0, cz + 0.2), grid, size: Math.min(size, cell * 0.85) };
  });
}

function ItemAt({ entry, index, count, settings, timeRef }: { entry: ReelItem; index: number; count: number; settings: ReelSettings; timeRef: React.RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const label = useRef<THREE.Group>(null);
  const ink = inkFor(settings.background);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = timeRef.current ?? 0;
    const p = new THREE.Vector3();
    let scale = 1;
    let spin = 0;

    if (settings.animation === "fly-in") {
      const start = 0.4 + index * (3.2 / Math.max(1, count));
      const k = clamp01((t - start) / 0.9);
      // a landscape photo layout leaves a portrait frame half empty, so portrait lands in the grid
      p.copy(settings.format === "9:16" ? entry.grid : entry.photo);
      p.y = (1 - easeOutBack(k)) * 3.5;
      scale = k === 0 ? 0 : 0.4 + 0.6 * clamp01(k * 1.4);
      spin = (1 - k) * Math.PI * 1.2 + Math.sin(t * 0.8 + index) * 0.15;
    } else if (settings.animation === "orbit") {
      const k = clamp01((t - index * 0.08) / 0.8);
      p.copy(entry.photo);
      scale = easeOutBack(k);
      spin = Math.sin(t * 0.9 + index) * 0.2;
    } else {
      const appear = clamp01((t - index * 0.06) / 0.6);
      const tidy = easeInOut(clamp01((t - 2.2 - index * 0.08) / 1.4));
      p.lerpVectors(entry.photo, entry.grid, tidy);
      p.y = Math.sin(tidy * Math.PI) * 0.6;
      scale = easeOutBack(appear);
      spin = tidy * Math.PI * 2;
    }
    g.position.copy(p);
    g.scale.setScalar(Math.max(0.0001, scale));
    g.rotation.y = spin;

    if (label.current) {
      const show = settings.labels !== "off" ? clamp01((t - (settings.animation === "knolling" ? 4.2 : 1.6 + index * 0.25)) / 0.5) : 0;
      label.current.position.set(p.x, 0.02, p.z + entry.size * 0.58);
      label.current.scale.setScalar(Math.max(0.0001, show));
    }
  });

  return (
    <>
      <group ref={group}>
        <Suspense fallback={null}>
          <KitModel url={entry.item.glbUrl!} size={entry.size} anchor="floor" />
        </Suspense>
      </group>
      <group ref={label} rotation={[-Math.PI / 2.6, 0, 0]}>
        <Text font={TEXT} fontSize={0.085} color={ink} anchorX="center" anchorY="top" maxWidth={1.2} textAlign="center">
          {entry.label}
        </Text>
      </group>
    </>
  );
}

function Rig({ settings, timeRef }: { settings: ReelSettings; timeRef: React.RefObject<number> }) {
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const portrait = settings.format === "9:16";
  useFrame(() => {
    const c = cam.current;
    if (!c) return;
    const t = timeRef.current ?? 0;
    const dist = portrait ? 6.2 : 5.4;
    if (settings.animation === "orbit") {
      const a = (t / DURATION_S) * Math.PI * 1.1 - 0.5;
      c.position.set(Math.sin(a) * dist * 0.55, dist * 0.82, Math.cos(a) * dist * 0.55);
    } else if (settings.animation === "knolling") {
      const top = easeInOut(clamp01((t - 2.4) / 1.6));
      c.position.set(0, dist * (0.78 + 0.2 * top), dist * (0.55 - 0.5 * top));
    } else {
      const push = easeInOut(clamp01(t / DURATION_S));
      c.position.set(0, dist * (0.9 - 0.025 * push), dist * (0.46 - 0.02 * push));
    }
    c.lookAt(0, 0, 0.1);
  });
  return <PerspectiveCamera ref={cam} makeDefault fov={portrait ? 42 : 38} position={[0, 5, 3]} />;
}

function Background({ color }: { color: string }) {
  const { scene } = useThree();
  scene.background = useMemo(() => new THREE.Color(color), [color]);
  return null;
}

export function ReelScene({ entries, settings, timeRef }: { entries: ReelItem[]; settings: ReelSettings; timeRef: React.RefObject<number> }) {
  const ink = inkFor(settings.background);
  const portrait = settings.format === "9:16";
  const titleRef = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = timeRef.current ?? 0;
    if (titleRef.current) titleRef.current.position.y = 0.6 + (1 - easeOutBack(clamp01(t / 0.8))) * 0.4;
  });

  return (
    <>
      <Background color={settings.background} />
      <Rig settings={settings} timeRef={timeRef} />
      <StudioLights />
      <ContactShadows position={[0, 0.001, 0.2]} opacity={0.38} scale={9} blur={2.4} far={1.6} resolution={512} color="#2a1e14" />
      <group ref={titleRef} position={[0, 0.6, portrait ? -2.15 : -1.75]} rotation={[-Math.PI / 3.2, 0, 0]}>
        <Text font={DISPLAY} fontSize={portrait ? 0.34 : 0.38} color={ink} anchorX="center" anchorY="middle" maxWidth={portrait ? 2.5 : 3.6} textAlign="center" lineHeight={0.95} letterSpacing={-0.02}>
          {settings.title}
        </Text>
      </group>
      {entries.map((e, i) => (
        <ItemAt key={e.item.id} entry={e} index={i} count={entries.length} settings={settings} timeRef={timeRef} />
      ))}
      <Text font={TEXT} fontSize={0.07} color={ink} position={[0, 0, portrait ? 2.55 : 1.95]} rotation={[-Math.PI / 2.6, 0, 0]} anchorX="center" fillOpacity={0.7}>
        Made with Kit
      </Text>
    </>
  );
}
