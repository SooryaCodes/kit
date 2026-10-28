"use client";

// One rebuilt model turning slowly on the paper, for the models section.

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import type * as THREE from "three";
import { ItemModel, type ItemModelHandle } from "./item-model";
import { PaperShadow } from "./paper-shadow";

function Turning({ url, onReady }: { url: string; onReady: () => void }) {
  const group = useRef<THREE.Group>(null);
  const handle = useRef<ItemModelHandle>(null);
  useEffect(() => onReady(), [onReady]);
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.rotation.y = t * 0.6;
    g.position.y = (handle.current?.halfHeight ?? 0) + 0.12 + Math.sin(t * 1.2) * 0.04;
    g.rotation.x = Math.sin(t * 0.7) * 0.12;
  });
  return (
    <group ref={group}>
      <ItemModel ref={handle} url={url} size={1.3} />
    </group>
  );
}

export default function SpinModel({ url, active, onReady }: { url: string; active: boolean; onReady: () => void }) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      frameloop={active ? "always" : "never"}
      camera={{ fov: 30, position: [0, 2.2, 3.4], near: 0.1, far: 30 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.25, 0)}
      gl={{ alpha: true, antialias: true }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <hemisphereLight args={["#ffffff", "#dedad3", 1.5]} />
      <directionalLight position={[2, 6, 4]} intensity={1.8} />
      <directionalLight position={[-4, 2, -2]} intensity={0.5} />
      <Suspense fallback={null}>
        <Turning url={url} onReady={onReady} />
      </Suspense>
      <PaperShadow position={[0, 0.001, 0]} width={3} height={3} far={1.2} blur={2.4} opacity={0.55} resolution={256} />
    </Canvas>
  );
}

