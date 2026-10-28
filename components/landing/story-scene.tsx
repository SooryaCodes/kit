"use client";

// The scroll story, in one canvas. The real bag photo lies on the paper; scroll progress (0 to 1) drives:
//   A  Muse Spark      a box draws round each item, with its name
//   B  SAM 3.1         each item's mask washes cobalt, then the photo falls away, leaving the cutouts
//   C  SAM 3D Objects  each cutout peels up and becomes its rebuilt model, turning once in the air
//   D  Kit             the models fly into a tidy knolling grid
//   E  Kit             a 9:16 Reel card slides in under the grid, with a title and a label per item
// Everything is a pure function of progress, so scrolling back plays it in reverse.

import { Line, Text, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { BAG_ITEMS, BAG_PHOTO, cut, glb, type BagItem } from "./data";
import { ItemModel, type ItemModelHandle } from "./item-model";
import { PaperShadow } from "./paper-shadow";

const SANS = "/fonts/HankenGrotesk-Medium.woff";
const SERIF = "/fonts/InstrumentSerif-Regular.woff";
const COBALT = "#2b44ff";

// photo in scene units
const PW = 4;
const PD = (PW * BAG_PHOTO.height) / BAG_PHOTO.width;
// the Reel card, 9:16
const CW = 2.4;
const CH = (CW * 16) / 9;
const FOV = 32;

// stage boundaries in scroll progress
export const STAGES = { a: 0.04, b: 0.25, c: 0.43, d: 0.64, e: 0.8 } as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (p: number, a: number, len: number) => clamp01((p - a) / len);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const lerp = THREE.MathUtils.lerp;

// knolling grid on the card: [item ids in the cell], column, row
const GRID: { ids: number[]; col: number; row: number; label: string }[] = [
  { ids: [6], col: 0, row: 0, label: "Headphones" },
  { ids: [0], col: 1, row: 0, label: "Backpack" },
  { ids: [12], col: 2, row: 0, label: "E-reader" },
  { ids: [14], col: 0, row: 1, label: "Tripod" },
  { ids: [1], col: 1, row: 1, label: "Laptop" },
  { ids: [2], col: 2, row: 1, label: "Notebook" },
  { ids: [7], col: 0, row: 2, label: "Cables pouch" },
  { ids: [11, 10, 9], col: 1, row: 2, label: "Pens" },
  { ids: [3], col: 2, row: 2, label: "Smartphone" },
  { ids: [8], col: 0, row: 3, label: "Power bank" },
  { ids: [13], col: 1, row: 3, label: "Hard drive" },
  { ids: [15], col: 2, row: 3, label: "USB stick" },
];
const COL_X = [-0.74, 0, 0.74];
const ROW_Z = [-0.98, -0.2, 0.58, 1.36];
const CELL = 0.56;
// a few reconstructions come back turned a quarter on the table; this puts them back as in the photo
const YAW: Record<number, number> = { 9: Math.PI / 2, 10: Math.PI / 2, 11: Math.PI / 2 };
// the three pens are found and framed together
const PEN_GROUP = [9, 10, 11];

interface Placement {
  item: BagItem;
  order: number;
  /** centre on the photo */
  photo: THREE.Vector3;
  /** longest side on the photo, the model's size */
  size: number;
  /** cutout PNG plane: centre and size */
  png: { x: number; z: number; w: number; d: number };
  box: { x0: number; z0: number; x1: number; z1: number };
  grid: THREE.Vector3;
  gridScale: number;
}

function toScene(pctX: number, pctY: number) {
  return { x: (pctX / 100) * PW - PW / 2, z: (pctY / 100) * PD - PD / 2 };
}

function penBox() {
  const pens = BAG_ITEMS.filter((i) => PEN_GROUP.includes(i.id));
  const a = toScene(Math.min(...pens.map((i) => i.box[0])), Math.min(...pens.map((i) => i.box[1])));
  const b = toScene(Math.max(...pens.map((i) => i.box[0] + i.box[2])), Math.max(...pens.map((i) => i.box[1] + i.box[3])));
  return { x0: a.x - 0.02, z0: a.z - 0.02, x1: b.x + 0.02, z1: b.z + 0.02 };
}

function usePlacements(): Placement[] {
  return useMemo(() => {
    // the order a reader would list them: rows from the top, left to right
    const ordered = [...BAG_ITEMS].sort((a, b) => a.box[1] + a.box[3] / 2 - (b.box[1] + b.box[3] / 2) || a.box[0] - b.box[0]);
    return BAG_ITEMS.map((item) => {
      const [bx, by, bw, bh] = item.box;
      const [px, py, pw, ph] = item.png;
      const c = toScene(bx + bw / 2, by + bh / 2);
      const pc = toScene(px + pw / 2, py + ph / 2);
      const b0 = toScene(bx, by);
      const b1 = toScene(bx + bw, by + bh);
      const size = Math.max((bw / 100) * PW, (bh / 100) * PD);
      const cell = GRID.find((g) => g.ids.includes(item.id))!;
      const k = cell.ids.indexOf(item.id);
      const multi = cell.ids.length > 1;
      const grid = new THREE.Vector3(COL_X[cell.col]!, 0, ROW_Z[cell.row]! + (multi ? (k - (cell.ids.length - 1) / 2) * 0.1 : 0));
      const area = Math.sqrt((bw * bh) / (31.71 * 49.85));
      const target = multi ? CELL * 0.95 : CELL * (0.72 + 0.5 * area);
      return {
        item,
        order: ordered.indexOf(item),
        photo: new THREE.Vector3(c.x, 0, c.z),
        size,
        png: { x: pc.x, z: pc.z, w: (pw / 100) * PW, d: (ph / 100) * PD },
        box: PEN_GROUP.includes(item.id) ? penBox() : { x0: b0.x - 0.02, z0: b0.z - 0.02, x1: b1.x + 0.02, z1: b1.z + 0.02 },
        grid,
        gridScale: Math.min(1, target / size),
      };
    });
  }, []);
}

/** Puts everything inside on layer 1: seen by the camera, ignored by the paper shadow. */
function NoShadow({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => o.layers.set(1));
  });
  return <group ref={ref}>{children}</group>;
}

const tintVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const tintFragment = /* glsl */ `
uniform sampler2D map;
uniform vec3 color;
uniform float tint;
uniform float opacity;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(map, vUv);
  gl_FragColor = vec4(mix(t.rgb, color, tint), t.a * opacity);
  #include <colorspace_fragment>
}
`;

function Cutout({ pl, progress }: { pl: Placement; progress: React.RefObject<number> }) {
  const tex = useTexture(cut("bag", pl.item.id));
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, color: { value: new THREE.Color(COBALT) }, tint: { value: 0 }, opacity: { value: 1 } },
      vertexShader: tintVertex,
      fragmentShader: tintFragment,
      transparent: true,
      depthWrite: false,
    });
  }, [tex]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const p = progress.current ?? 0;
    const i = pl.order;
    const tint = 0.62 * easeOut(span(p, STAGES.b + i * 0.007, 0.035)) * (1 - span(p, STAGES.b + 0.12, 0.04));
    const s = STAGES.c + i * 0.008;
    const peel = easeInOut(span(p, s, 0.07));
    const swap = span(p, s + 0.035, 0.018);
    material.uniforms.tint!.value = tint;
    material.uniforms.opacity!.value = (1 - swap) * (p < STAGES.b ? 0 : 1);
    m.visible = p >= STAGES.b && swap < 1;
    m.position.y = 0.004 + peel * 0.22;
    m.rotation.x = -Math.PI / 2 + Math.sin(peel * Math.PI) * 0.35;
  });

  return (
    <mesh ref={mesh} position={[pl.png.x, 0.004, pl.png.z]} rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={2}>
      <planeGeometry args={[pl.png.w, pl.png.d]} />
    </mesh>
  );
}

function FoundBox({ pl, progress }: { pl: Placement; progress: React.RefObject<number> }) {
  const line = useRef<React.ComponentRef<typeof Line>>(null);
  const label = useRef<THREE.Mesh>(null);
  const { x0, z0, x1, z1 } = pl.box;
  const perimeter = 2 * (x1 - x0 + (z1 - z0));
  const points = useMemo(
    () => [
      [x0, 0.006, z0],
      [x1, 0.006, z0],
      [x1, 0.006, z1],
      [x0, 0.006, z1],
      [x0, 0.006, z0],
    ] as [number, number, number][],
    [x0, x1, z0, z1],
  );

  useFrame(() => {
    const p = progress.current ?? 0;
    const draw = easeInOut(span(p, STAGES.a + pl.order * 0.011, 0.05));
    const fade = 1 - span(p, STAGES.b + 0.1, 0.04);
    const l = line.current;
    if (l) {
      const mat = l.material;
      mat.dashOffset = perimeter * (1 - draw);
      mat.opacity = fade;
      l.visible = draw > 0 && fade > 0;
    }
    const t = label.current as (THREE.Mesh & { fillOpacity: number }) | null;
    if (t) {
      const show = span(p, STAGES.a + pl.order * 0.011 + 0.03, 0.03) * fade;
      t.visible = show > 0;
      t.fillOpacity = show;
    }
  });

  return (
    <>
      <Line ref={line} points={points} color={COBALT} lineWidth={1.6} dashed dashSize={perimeter} gapSize={perimeter} transparent depthWrite={false} renderOrder={3} />
      <Text
        ref={label}
        font={SANS}
        fontSize={0.085}
        color={COBALT}
        anchorX="left"
        anchorY="bottom"
        position={[x0, 0.007, z0 - 0.025]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={3}
      >
        {PEN_GROUP.includes(pl.item.id) ? "Pens" : pl.item.name}
      </Text>
    </>
  );
}

function Model({ pl, progress }: { pl: Placement; progress: React.RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const handle = useRef<ItemModelHandle>(null);
  const seed = pl.item.id * 1.37;

  useFrame((state) => {
    const g = group.current;
    const h = handle.current;
    if (!g || !h) return;
    const p = progress.current ?? 0;
    const t = state.clock.elapsedTime;
    const s = STAGES.c + pl.order * 0.008;
    const appear = span(p, s + 0.035, 0.018);
    h.setOpacity(appear);
    g.visible = appear > 0;
    if (!g.visible) return;

    const rise = easeOut(span(p, s + 0.02, 0.1));
    const spin = easeInOut(span(p, s + 0.03, 0.15));
    const move = easeInOut(span(p, STAGES.d + pl.order * 0.006, 0.11));
    const scale = lerp(1, pl.gridScale, move);
    const rest = h.halfHeight * scale;
    // big things lift less, so the backpack never climbs into the heading
    const lift = rise * (1 - move) * (0.3 + (pl.order % 3) * 0.06) * Math.min(1, 0.8 / pl.size);
    const arc = Math.sin(move * Math.PI) * 0.35;
    const float = rise * (1 - move) * Math.sin(t * 1.1 + seed) * 0.025;

    g.position.set(lerp(pl.photo.x, pl.grid.x, move), rest + lift + arc + float, lerp(pl.photo.z, pl.grid.z, move));
    g.scale.setScalar(scale);
    g.rotation.set(Math.sin(spin * Math.PI) * 0.25, (YAW[pl.item.id] ?? 0) + spin * Math.PI * 2, Math.sin(spin * Math.PI) * -0.12);
  });

  return (
    <group ref={group} visible={false}>
      <ItemModel ref={handle} url={glb("bag", pl.item.id)} size={pl.size} />
    </group>
  );
}

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(s, 12);
}

function ReelCard({ progress }: { progress: React.RefObject<number> }) {
  const card = useRef<THREE.Mesh>(null);
  const words = useRef<THREE.Group>(null);
  const geometry = useMemo(() => roundedRect(CW, CH, 0.16), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: COBALT, transparent: true, opacity: 0 }), []);

  useFrame(() => {
    const p = progress.current ?? 0;
    const k = easeOut(span(p, STAGES.e - 0.02, 0.08));
    const c = card.current;
    if (c) {
      c.visible = k > 0;
      material.opacity = k;
      c.scale.setScalar(0.94 + 0.06 * k);
    }
    const w = words.current;
    if (w) {
      const show = span(p, STAGES.e + 0.05, 0.05);
      w.visible = show > 0;
      w.traverse((o) => {
        if ("fillOpacity" in o) (o as THREE.Object3D & { fillOpacity: number }).fillOpacity = show;
      });
      w.position.y = 0.008 + (1 - show) * 0.05;
    }
  });

  return (
    <>
      <mesh ref={card} geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} visible={false} />
      <group ref={words} visible={false}>
        <Text font={SERIF} fontSize={0.34} color="#ffffff" anchorX="center" anchorY="middle" position={[0, 0, -CH / 2 + 0.56]} rotation={[-Math.PI / 2, 0, 0]} letterSpacing={-0.02}>
          {"What’s in my bag"}
        </Text>
        {GRID.map((g) => (
          <Text
            key={g.label}
            font={SANS}
            fontSize={0.082}
            color="#eef0ff"
            anchorX="center"
            anchorY="top"
            position={[COL_X[g.col]!, 0, ROW_Z[g.row]! + 0.34]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            {g.label}
          </Text>
        ))}
        <Text font={SANS} fontSize={0.06} color="#c2caff" anchorX="center" anchorY="middle" position={[0, 0, CH / 2 - 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
          Made with Kit
        </Text>
      </group>
    </>
  );
}

function Photo({ progress }: { progress: React.RefObject<number> }) {
  const tex = useTexture(BAG_PHOTO.src);
  const material = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  }, [tex]);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const p = progress.current ?? 0;
    const o = 1 - span(p, STAGES.b + 0.11, 0.06);
    material.opacity = o;
    if (mesh.current) mesh.current.visible = o > 0;
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={1}>
      <planeGeometry args={[PW, PD]} />
    </mesh>
  );
}

/** Camera: straight down over the photo, tilting to three quarters while the models rise, back over the card. */
function Rig({ progress, bands }: { progress: React.RefObject<number>; bands: { top: number; bottom: number } }) {
  const { camera, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);

  useLayoutEffect(() => {
    camera.layers.enable(1);
  }, [camera]);

  useFrame(() => {
    const p = progress.current ?? 0;
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const avail = Math.max(0.3, 1 - (bands.top + bands.bottom) / size.height);
    const fit = (w: number, d: number, fw: number, fh: number) => Math.max(d / (2 * tan * avail * fh), w / (2 * tan * aspect * fw));
    // the items sit in the middle 72% of the photo, so on narrow screens the print may bleed off the edges
    const photoDist = fit(PW, PD, 1.22, 0.9);
    const cardDist = fit(CW, CH, 0.9, 0.92);

    const tilt = easeInOut(span(p, STAGES.c, 0.12));
    const settle = easeInOut(span(p, STAGES.d, 0.16));
    const elevDeg = lerp(lerp(89.4, 54, tilt), 84, settle);
    const az = Math.sin(tilt * Math.PI * 0.5) * (1 - settle) * 0.32;
    const dist = lerp(lerp(photoDist, photoDist * 1.08, tilt), cardDist, settle);

    // keep the subject centred in the band between the heading and the caption
    const worldPerPx = (2 * tan * dist) / size.height;
    target.set(0, 0, ((bands.bottom - bands.top) / 2) * worldPerPx * (1 - tilt * (1 - settle)));

    const e = THREE.MathUtils.degToRad(elevDeg);
    cam.position.set(target.x + Math.sin(az) * Math.cos(e) * dist, Math.sin(e) * dist, target.z + Math.cos(az) * Math.cos(e) * dist);
    cam.lookAt(target);
  });

  return null;
}

function Lights() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#dedad3", 1.5]} />
      <directionalLight position={[2, 6, 4]} intensity={1.7} />
      <directionalLight position={[-4, 2, -2]} intensity={0.5} />
    </>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    const id = requestAnimationFrame(() => onReady());
    return () => cancelAnimationFrame(id);
  }, [onReady]);
  return null;
}

function Scene({ progress, bands, onReady }: { progress: React.RefObject<number>; bands: { top: number; bottom: number }; onReady: () => void }) {
  const placements = usePlacements();
  return (
    <>
      <Lights />
      <Rig progress={progress} bands={bands} />
      <Suspense fallback={null}>
        <NoShadow>
          <Photo progress={progress} />
          {placements.map((pl) => (
            <Cutout key={pl.item.id} pl={pl} progress={progress} />
          ))}
          {placements
            .filter((pl) => pl.item.id !== 9 && pl.item.id !== 10)
            .map((pl) => (
              <FoundBox key={pl.item.id} pl={pl} progress={progress} />
            ))}
          <ReelCard progress={progress} />
        </NoShadow>
        <Ready onReady={onReady} />
      </Suspense>
      <Suspense fallback={null}>
        {placements.map((pl) => (
          <Model key={pl.item.id} pl={pl} progress={progress} />
        ))}
      </Suspense>
      <PaperShadow position={[0, 0.003, 0]} width={9} height={9} far={1.4} blur={2} opacity={0.55} resolution={1024} />
    </>
  );
}

export default function StoryScene({ progress, bands, active, onReady }: { progress: React.RefObject<number>; bands: { top: number; bottom: number }; active: boolean; onReady: () => void }) {
  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      camera={{ fov: FOV, near: 0.1, far: 80, position: [0, 9, 0.1] }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <Scene progress={progress} bands={bands} onReady={onReady} />
    </Canvas>
  );
}
