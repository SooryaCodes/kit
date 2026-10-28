"use client";

// One reconstructed item, normalised for display:
// - SAM 3D keeps the photo's camera frame, so flat-lay items come out facing the camera.
//   We turn each model so its thinnest side points up: it lies on the table like in the photo.
// - Centred on the origin and scaled so its longest side is `size` units (relative sizes come from the caller).
// - Lit with soft studio light: the baked photo texture keeps its look, dark and white items keep shading.

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export function normaliseScene(source: THREE.Object3D, size: number, anchor: "center" | "floor" = "center"): THREE.Group {
  const root = source.clone(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    mesh.material = new THREE.MeshStandardMaterial({ map: src.map ?? null, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  });

  const box = new THREE.Box3().setFromObject(root);
  const dims = box.getSize(new THREE.Vector3());
  // thinnest axis → up (+Y)
  if (dims.z < dims.y && dims.z < dims.x) root.rotation.x = -Math.PI / 2;
  else if (dims.x < dims.y && dims.x < dims.z) root.rotation.z = Math.PI / 2;
  root.updateMatrixWorld(true);

  const turned = new THREE.Box3().setFromObject(root);
  const span = turned.getSize(new THREE.Vector3());
  const longest = Math.max(span.x, span.y, span.z) || 1;
  const centre = turned.getCenter(new THREE.Vector3());

  const group = new THREE.Group();
  // "floor": the model rests on y = 0 (for scenes with a ground and contact shadows)
  root.position.sub(anchor === "floor" ? new THREE.Vector3(centre.x, turned.min.y, centre.z) : centre);
  group.add(root);
  group.scale.setScalar(size / longest);
  return group;
}

export function KitModel({ url, size = 1, anchor = "center" }: { url: string; size?: number; anchor?: "center" | "floor" }) {
  const { scene } = useGLTF(url);
  const object = useMemo(() => normaliseScene(scene, size, anchor), [scene, size, anchor]);
  return <primitive object={object} />;
}

/** Soft key + fill + rim, no external HDR files. */
export function StudioLights() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#e7e4de", 1.1]} />
      <directionalLight position={[2, 4, 3]} intensity={1.8} />
      <directionalLight position={[-3, 2, -2]} intensity={0.6} />
    </>
  );
}
