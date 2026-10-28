"use client";

// The hero's live objects: the same scatter as the static cutouts, rebuilt from the real GLBs.
// Each item faces the camera, drifts slowly, tilts toward the cursor by its depth, and drops a soft shadow
// on the paper behind it. The canvas is transparent so the paper sweep and grid show through.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { glb, type Placed } from "./data";
import { ItemModel } from "./item-model";
import { PaperShadow } from "./paper-shadow";

export interface StageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const CAMERA_Z = 10;

function Lights() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#dedad3", 1.5]} />
      <directionalLight position={[2, 5, 6]} intensity={1.7} />
      <directionalLight position={[-4, 1, 3]} intensity={0.45} />
    </>
  );
}

function Floater({ p, i, stage, pointer }: { p: Placed; i: number; stage: StageRect; pointer: React.RefObject<{ x: number; y: number }> }) {
  const outer = useRef<THREE.Group>(null);
  const { size, viewport } = useThree();
  const z = p.d * 0.6 - 0.1;

  const { base, unit } = useMemo(() => {
    const u = viewport.width / size.width;
    const wPx = (p.w / 100) * stage.width;
    const hPx = wPx * (p.px[1] / p.px[0]);
    const cx = stage.left + (p.x / 100) * stage.width + wPx / 2;
    const cy = stage.top + (p.y / 100) * stage.height + hPx / 2;
    const perspective = (CAMERA_Z - z) / CAMERA_Z;
    const pos = new THREE.Vector3((cx - size.width / 2) * u * perspective, -(cy - size.height / 2) * u * perspective, z);
    // the cutout PNG has a little padding around the item
    return { base: { pos, longest: Math.max(wPx, hPx) * 0.9 * u * perspective }, unit: u };
  }, [p, stage, size.width, size.height, viewport.width, z]);

  const seed = i * 1.618;
  const rz = (-p.r * Math.PI) / 180;

  useFrame((state, delta) => {
    const g = outer.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const pt = pointer.current ?? { x: 0, y: 0 };
    const k = 0.35 + p.d * 0.65;
    const scroll = typeof window === "undefined" ? 0 : window.scrollY;
    // drift
    const dx = Math.sin(t * 0.37 + seed) * 0.05 + pt.x * 0.18 * k;
    const dy = Math.cos(t * 0.31 + seed * 0.7) * 0.07 + pt.y * 0.12 * k + scroll * unit * (0.15 + p.d * 0.35);
    g.position.x = THREE.MathUtils.damp(g.position.x, base.pos.x + dx, 4, Math.min(delta, 0.05));
    g.position.y = THREE.MathUtils.damp(g.position.y, base.pos.y + dy, 4, Math.min(delta, 0.05));
    g.position.z = base.pos.z;
    // tilt toward the cursor, and a slow breathing turn
    const tx = -pt.y * 0.32 * k + Math.sin(t * 0.5 + seed) * 0.06;
    const ty = pt.x * 0.42 * k + Math.cos(t * 0.43 + seed) * 0.08;
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, tx, 3, Math.min(delta, 0.05));
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, ty, 3, Math.min(delta, 0.05));
    g.rotation.z = rz;
  });

  return (
    <group ref={outer} position={base.pos}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <ItemModel url={glb(p.set, p.id)} size={base.longest} />
      </group>
    </group>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    // one frame after the models mount, so the first visible frame is complete
    const id = requestAnimationFrame(() => onReady());
    return () => cancelAnimationFrame(id);
  }, [onReady]);
  return null;
}

function Scene({ layout, stage, onReady }: { layout: Placed[]; stage: StageRect; onReady: () => void }) {
  const pointer = useRef({ x: 0, y: 0 });
  const { viewport } = useThree();

  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  return (
    <>
      <Lights />
      <Suspense fallback={null}>
        {layout.map((p, i) => (
          <Floater key={`${p.set}-${p.id}`} p={p} i={i} stage={stage} pointer={pointer} />
        ))}
        <Ready onReady={onReady} />
      </Suspense>
      {/* the paper behind the objects: shadows fall slightly below, as from a soft top light */}
      <PaperShadow
        position={[0, 0, -0.5]}
        rotation={[Math.PI / 2, 0, 0]}
        shift={[0.04 * Math.min(1, viewport.width / 9.4), 0.16 * Math.min(1, viewport.width / 9.4)]}
        width={viewport.width * 1.3}
        height={viewport.height * 1.25}
        far={1.6}
        blur={1.4}
        opacity={0.55}
        resolution={1024}
      />
    </>
  );
}

export default function HeroScene({ layout, stage, active, onReady }: { layout: Placed[]; stage: StageRect; active: boolean; onReady: () => void }) {
  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0, CAMERA_Z], fov: 30, near: 0.1, far: 50 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <Scene layout={layout} stage={stage} onReady={onReady} />
    </Canvas>
  );
}
