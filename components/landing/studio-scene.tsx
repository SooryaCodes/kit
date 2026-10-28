"use client";

// The live studio preview: three real items from the sample bag, animated the way the studio's presets do.
// Any change to the settings makes the items hop, so every click visibly lands on the objects.

import { Text } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { glb } from "./data";
import { ItemModel, type ItemModelHandle } from "./item-model";
import { PaperShadow } from "./paper-shadow";

export type StudioAnimation = "fly-in" | "orbit" | "knolling";
export interface StudioSettings {
  ground: string;
  ink: string;
  animation: StudioAnimation;
  labels: boolean;
  square: boolean;
}

const SANS = "/fonts/HankenGrotesk-Medium.woff";
const LOOP = 5.2;

const ITEMS = [
  { id: 0, name: "Backpack", size: 1.2, at: new THREE.Vector3(0, 0, -0.32), mess: { x: 0.35, z: -0.1, r: 0.7 } },
  { id: 6, name: "Headphones", size: 0.72, at: new THREE.Vector3(-0.5, 0, 0.6), mess: { x: -0.15, z: 0.15, r: -1.1 } },
  { id: 12, name: "E-reader", size: 0.56, at: new THREE.Vector3(0.52, 0, 0.6), mess: { x: 0.2, z: -0.25, r: 0.9 } },
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function Item({ item, index, settings, clock }: { item: (typeof ITEMS)[number]; index: number; settings: StudioSettings; clock: React.RefObject<{ start: number; hop: number }> }) {
  const group = useRef<THREE.Group>(null);
  const handle = useRef<ItemModelHandle>(null);
  const label = useRef<THREE.Group>(null);

  // labels live on layer 1: the camera sees them, the paper shadow does not
  useLayoutEffect(() => {
    label.current?.traverse((o) => o.layers.set(1));
  });

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const now = state.clock.elapsedTime;
    const t = (now - (clock.current?.start ?? 0)) % LOOP;
    const hopT = now - (clock.current?.hop ?? -10);
    const hop = hopT < 0.6 ? Math.sin(clamp01(hopT / 0.6) * Math.PI) * 0.16 * (1 - index * 0.15) : 0;
    const rest = handle.current?.halfHeight ?? 0;
    let x = item.at.x;
    let z = item.at.z;
    let y = rest;
    let yaw = 0;

    if (settings.animation === "fly-in") {
      const k = easeOut(clamp01((t - 0.2 - index * 0.35) / 0.9));
      y = rest + (1 - k) * 1.3;
      yaw = (1 - k) * Math.PI * 1.5;
    } else if (settings.animation === "knolling") {
      const k = easeInOut(clamp01((t - 0.9 - index * 0.12) / 1.1));
      x = item.at.x + item.mess.x * (1 - k);
      z = item.at.z + item.mess.z * (1 - k);
      yaw = item.mess.r * (1 - k);
      y = rest + Math.sin(k * Math.PI) * 0.18;
    } else {
      yaw = Math.sin(now * 0.6 + index) * 0.08;
    }
    g.position.set(x, y + hop + Math.sin(now * 1.3 + index * 2) * 0.012, z);
    g.rotation.y = yaw;
    if (label.current) label.current.position.set(x, 0.01, z + item.size * 0.5 + 0.06);
  });

  return (
    <>
      <group ref={group}>
        <ItemModel ref={handle} url={glb("bag", item.id)} size={item.size} />
      </group>
      <group ref={label} visible={settings.labels}>
        <Text font={SANS} fontSize={0.085} color={settings.ink} anchorX="center" anchorY="top" rotation={[-Math.PI / 2.4, 0, 0]}>
          {item.name}
        </Text>
      </group>
    </>
  );
}

function Rig({ settings, clock }: { settings: StudioSettings; clock: React.RefObject<{ start: number; hop: number }> }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    camera.layers.enable(1);
  }, [camera]);
  useFrame((state) => {
    const aspect = size.width / size.height;
    const tan = Math.tan(THREE.MathUtils.degToRad(17));
    // fit the three items' footprint to the card, leaving the top fifth for the title
    const dist = Math.max(2.25 / (2 * tan * aspect), 3.3 / (2 * tan));
    const t = state.clock.elapsedTime - (clock.current?.start ?? 0);
    const az = settings.animation === "orbit" ? t * 0.55 : 0;
    const el = THREE.MathUtils.degToRad(settings.animation === "orbit" ? 50 : 64);
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist + 0.1);
    camera.lookAt(0, 0.1, -0.3);
  });
  return null;
}

function Scene({ settings, onReady }: { settings: StudioSettings; onReady: () => void }) {
  const clock = useRef({ start: 0, hop: -10 });
  const { clock: three } = useThree();
  const first = useRef(true);
  const key = `${settings.ground}|${settings.animation}|${settings.labels}|${settings.square}`;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    clock.current.hop = three.elapsedTime;
  }, [key, three]);

  useEffect(() => {
    clock.current.start = three.elapsedTime;
  }, [settings.animation, three]);

  const lights = useMemo(
    () => (
      <>
        <hemisphereLight args={["#ffffff", "#dedad3", 1.5]} />
        <directionalLight position={[2, 6, 4]} intensity={1.8} />
        <directionalLight position={[-4, 2, -2]} intensity={0.5} />
      </>
    ),
    [],
  );

  return (
    <>
      {lights}
      <Rig settings={settings} clock={clock} />
      <Suspense fallback={null}>
        {ITEMS.map((it, i) => (
          <Item key={it.id} item={it} index={i} settings={settings} clock={clock} />
        ))}
        <Ready onReady={onReady} />
      </Suspense>
      <PaperShadow position={[0, 0.002, 0.1]} width={5} height={5} far={1.6} blur={2} opacity={0.5} resolution={512} />
    </>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => onReady(), [onReady]);
  return null;
}

export default function StudioScene({ settings, active, onReady }: { settings: StudioSettings; active: boolean; onReady: () => void }) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      frameloop={active ? "always" : "never"}
      camera={{ fov: 34, near: 0.1, far: 40, position: [0, 4, 4] }}
      gl={{ alpha: true, antialias: true }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <Scene settings={settings} onReady={onReady} />
    </Canvas>
  );
}
