"use client";

// Soft contact shadows on the paper. Same idea as drei's ContactShadows (render the scene's depth from the
// plane, blur it, show it on the plane), with one change the reconstructions need: the depth pass draws both
// sides of every face. SAM 3D meshes are open shells, so seen from behind they would cast nothing.
// Lies flat (shadow camera looks up +Y) unless rotated; the shadow falls along the camera's axis.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const BLUR_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const blurFragment = (axis: "x" | "y") => /* glsl */ `
uniform sampler2D tDiffuse;
uniform float amount;
varying vec2 vUv;
void main() {
  vec4 sum = vec4(0.0);
  vec2 d = vec2(${axis === "x" ? "amount, 0.0" : "0.0, amount"});
  sum += texture2D(tDiffuse, vUv - 4.0 * d) * 0.051;
  sum += texture2D(tDiffuse, vUv - 3.0 * d) * 0.0918;
  sum += texture2D(tDiffuse, vUv - 2.0 * d) * 0.12245;
  sum += texture2D(tDiffuse, vUv - 1.0 * d) * 0.1531;
  sum += texture2D(tDiffuse, vUv) * 0.1633;
  sum += texture2D(tDiffuse, vUv + 1.0 * d) * 0.1531;
  sum += texture2D(tDiffuse, vUv + 2.0 * d) * 0.12245;
  sum += texture2D(tDiffuse, vUv + 3.0 * d) * 0.0918;
  sum += texture2D(tDiffuse, vUv + 4.0 * d) * 0.051;
  gl_FragColor = sum;
}
`;

export interface PaperShadowProps {
  width: number;
  height: number;
  far?: number;
  blur?: number;
  opacity?: number;
  resolution?: number;
  color?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** slide the drawn shadow along the plane (x, and away from the plane's top edge), as if lit from one side */
  shift?: [number, number];
}

export function PaperShadow({ width, height, far = 2, blur = 2.5, opacity = 0.5, resolution = 512, color = "#2a2018", position, rotation, shift = [0, 0] }: PaperShadowProps) {
  const group = useRef<THREE.Group>(null);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);

  const parts = useMemo(() => {
    const aspect = width / height;
    const rw = aspect >= 1 ? resolution : Math.round(resolution * aspect);
    const rh = aspect >= 1 ? Math.round(resolution / aspect) : resolution;
    const target = new THREE.WebGLRenderTarget(rw, rh);
    const targetBlur = new THREE.WebGLRenderTarget(rw, rh);
    target.texture.generateMipmaps = targetBlur.texture.generateMipmaps = false;

    const plane = new THREE.PlaneGeometry(width, height).rotateX(Math.PI / 2);
    // the blur runs on its own full-screen quad and camera, wherever the shadow plane is placed
    const quad = new THREE.PlaneGeometry(2, 2);
    const blurPlane = new THREE.Mesh(quad);
    blurPlane.frustumCulled = false;
    const blurCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const depth = new THREE.MeshDepthMaterial({ side: THREE.DoubleSide });
    depth.depthTest = depth.depthWrite = false;
    depth.onBeforeCompile = (shader) => {
      shader.uniforms.ucolor = { value: new THREE.Color(color) };
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "uniform vec3 ucolor;\nvoid main() {")
        .replace("vec4( vec3( 1.0 - fragCoordZ ), opacity );", "vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );");
    };

    const blurX = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, amount: { value: 0 } }, vertexShader: BLUR_VERTEX, fragmentShader: blurFragment("x") });
    const blurY = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, amount: { value: 0 } }, vertexShader: BLUR_VERTEX, fragmentShader: blurFragment("y") });
    blurX.depthTest = blurY.depthTest = false;

    const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0, far);

    const material = new THREE.MeshBasicMaterial({ map: target.texture, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    return { target, targetBlur, plane, quad, blurPlane, blurCamera, depth, blurX, blurY, camera, material, rw, rh };
  }, [width, height, far, resolution, color, opacity]);

  useEffect(
    () => () => {
      parts.target.dispose();
      parts.targetBlur.dispose();
      parts.plane.dispose();
      parts.quad.dispose();
      parts.depth.dispose();
      parts.blurX.dispose();
      parts.blurY.dispose();
      parts.material.dispose();
    },
    [parts],
  );

  const blurPass = (amount: number) => {
    const { blurPlane, blurCamera, blurX, blurY, target, targetBlur, rw, rh } = parts;
    blurPlane.visible = true;
    blurPlane.material = blurX;
    blurX.uniforms.tDiffuse!.value = target.texture;
    blurX.uniforms.amount!.value = amount / rw;
    gl.setRenderTarget(targetBlur);
    gl.render(blurPlane, blurCamera);
    blurPlane.material = blurY;
    blurY.uniforms.tDiffuse!.value = targetBlur.texture;
    blurY.uniforms.amount!.value = amount / rh;
    gl.setRenderTarget(target);
    gl.render(blurPlane, blurCamera);
    blurPlane.visible = false;
  };

  useFrame(() => {
    const g = group.current;
    if (!g || opacity <= 0) return;
    const bg = scene.background;
    const override = scene.overrideMaterial;
    g.visible = false;
    scene.background = null;
    scene.overrideMaterial = parts.depth;
    gl.setRenderTarget(parts.target);
    gl.render(scene, parts.camera);
    blurPass(blur * 2);
    blurPass(blur * 0.8);
    gl.setRenderTarget(null);
    g.visible = true;
    scene.overrideMaterial = override;
    scene.background = bg;
  });

  return (
    <group ref={group} position={position} rotation={rotation}>
      <group rotation-x={Math.PI / 2}>
        <mesh geometry={parts.plane} material={parts.material} position={[shift[0], shift[1], 0]} rotation={[-Math.PI / 2, 0, 0]} />
        <primitive object={parts.camera} />
      </group>
    </group>
  );
}
