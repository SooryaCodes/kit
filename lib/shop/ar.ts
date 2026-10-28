// AR copies of product models, at real size, for "See it in your room".
// Android Scene Viewer reads the GLB directly and iOS Quick Look converts it in the browser, so the copy is
// plain glTF: no meshopt compression, JPEG textures. One unit is one metre (glTF convention), the longest side
// is the seller's confirmed size, and the model rests on the floor (y = 0), centred, lying as photographed.

import "server-only";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize, getBounds, textureCompress } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";
import { createLogger } from "../log";
import { supabaseAdmin } from "../supabase/server";
import { downloadFile, publicUrl, uploadFile } from "../supabase/storage";

const log = createLogger("shop:ar");

let io: NodeIO | undefined;
async function getIO(): Promise<NodeIO> {
  if (!io) {
    await MeshoptDecoder.ready;
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  }
  return io;
}

/** Storage path of an item's AR copy; the size is in the name so a new size never serves a stale file. */
export function arPath(itemId: string, sizeM: number): string {
  return `ar/${itemId}/${Math.round(sizeM * 1000)}mm.glb`;
}

export async function buildArGlb(glb: Buffer, sizeM: number): Promise<Buffer> {
  const nodeIO = await getIO();
  const doc = await nodeIO.readBinary(new Uint8Array(glb));
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (!scene) throw new Error("GLB has no scene");

  // same rule as the 3D views: the thinnest side points up, so flat-lay items lie as photographed
  const box = getBounds(scene);
  const dims = [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]] as const;
  const thinnest = dims.indexOf(Math.min(...dims));
  const s = Math.SQRT1_2;
  const rotation: [number, number, number, number] =
    thinnest === 2 ? [-s, 0, 0, s] : thinnest === 0 ? [0, 0, s, s] : [0, 0, 0, 1];

  const pivot = doc.createNode("product").setRotation(rotation);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    pivot.addChild(child);
  }
  scene.addChild(pivot);
  const turned = getBounds(scene);
  const span = Math.max(turned.max[0] - turned.min[0], turned.max[1] - turned.min[1], turned.max[2] - turned.min[2]) || 1;
  const k = sizeM / span;
  pivot.setScale([k, k, k]);
  const placed = getBounds(scene);
  pivot.setTranslation([-(placed.min[0] + placed.max[0]) / 2, -placed.min[1], -(placed.min[2] + placed.max[2]) / 2]);

  // plain glTF for every AR viewer: JPEG textures, no compression extensions
  await doc.transform(dequantize(), textureCompress({ encoder: sharp, targetFormat: "jpeg", resize: [1024, 1024] }));
  for (const ext of root.listExtensionsUsed()) ext.dispose();
  return Buffer.from(await nodeIO.writeBinary(doc));
}

/** Public URL of the item's real-size AR model, built and stored on first request. */
export async function arModelUrl(item: { id: string; glb_path: string | null; real_size_m: number | null }): Promise<string | null> {
  if (!item.glb_path || !item.real_size_m) return null;
  const path = arPath(item.id, Number(item.real_size_m));
  const { data } = await supabaseAdmin().storage.from("glbs").list(`ar/${item.id}`, { search: path.split("/").pop() });
  if (!data?.length) {
    const started = performance.now();
    const out = await buildArGlb(await downloadFile("glbs", item.glb_path), Number(item.real_size_m));
    await uploadFile("glbs", path, out, "model/gltf-binary");
    log.info("ar model built", { item: item.id, sizeM: item.real_size_m, bytes: out.length, ms: Math.round(performance.now() - started) });
  }
  return publicUrl("glbs", path);
}
