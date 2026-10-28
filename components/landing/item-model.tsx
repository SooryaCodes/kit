"use client";

// One reconstructed item for the landing scenes. Uses the shared normaliser (thinnest side up, centred,
// longest side = `size`) and reports its resting height so it can sit on the paper instead of sinking into it.
// `fade` lets a scene cross-fade a model in from its flat cutout.

import { useGLTF } from "@react-three/drei";
import { forwardRef, useImperativeHandle, useMemo } from "react";
import * as THREE from "three";
import { normaliseScene } from "@/components/three/kit-model";

export interface ItemModelHandle {
  /** half the model's height after normalising, in scene units */
  halfHeight: number;
  /** set the opacity of every material (1 = solid, depth-written) */
  setOpacity: (o: number) => void;
}

export const ItemModel = forwardRef<ItemModelHandle, { url: string; size: number; castShadow?: boolean }>(function ItemModel({ url, size, castShadow = false }, ref) {
  const { scene } = useGLTF(url);
  const { object, halfHeight, materials } = useMemo(() => {
    const object = normaliseScene(scene, size);
    const box = new THREE.Box3().setFromObject(object);
    const materials: THREE.MeshStandardMaterial[] = [];
    object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = castShadow;
      materials.push(mesh.material as THREE.MeshStandardMaterial);
    });
    return { object, halfHeight: (box.max.y - box.min.y) / 2, materials };
  }, [scene, size, castShadow]);

  useImperativeHandle(
    ref,
    () => ({
      halfHeight,
      setOpacity: (o: number) => {
        const solid = o >= 0.999;
        for (const m of materials) {
          if (m.transparent === solid) {
            m.transparent = !solid;
            m.needsUpdate = true;
          }
          m.opacity = o;
          m.depthWrite = solid;
        }
        object.visible = o > 0.001;
      },
    }),
    [halfHeight, materials, object],
  );

  return <primitive object={object} />;
});
