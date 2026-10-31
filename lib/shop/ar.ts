// AR copies of product models, at real size, for "See it in your room".
// Android Scene Viewer reads the GLB directly and iOS Quick Look converts it in the browser, so the copy is
// plain glTF: no meshopt compression, JPEG textures. One unit is one metre (glTF convention), the longest side
// is the seller's confirmed size, and the model rests on the floor (y = 0), centred, lying flat or standing up.

import "server-only";
import { createHash } from "node:crypto";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize, getBounds, mergeDocuments, prune, textureCompress, unpartition } from "@gltf-transform/functions";
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
export type ArPose = "flat" | "upright";

export function arPath(itemId: string, sizeM: number, pose: ArPose = "flat"): string {
  return `ar/${itemId}/${Math.round(sizeM * 1000)}mm-${pose}.glb`;
}

/**
 * flat:    the thinnest side points up, so a product photographed from above lies as it did in the photo
 * upright: the photo's own up stays up, so a product photographed from the front stands on its base
 */
export async function buildArGlb(glb: Buffer, sizeM: number, pose: ArPose = "flat"): Promise<Buffer> {
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
    pose === "upright" ? [0, 0, 0, 1] : thinnest === 2 ? [-s, 0, 0, s] : thinnest === 0 ? [0, 0, s, s] : [0, 0, 0, 1];

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
export async function arModelUrl(item: { id: string; glb_path: string | null; real_size_m: number | null; ar_pose?: string | null }): Promise<string | null> {
  if (!item.glb_path || !item.real_size_m) return null;
  const pose: ArPose = item.ar_pose === "upright" ? "upright" : "flat";
  const path = arPath(item.id, Number(item.real_size_m), pose);
  const { data } = await supabaseAdmin().storage.from("glbs").list(`ar/${item.id}`, { search: path.split("/").pop() });
  if (!data?.length) {
    const started = performance.now();
    const out = await buildArGlb(await downloadFile("glbs", item.glb_path), Number(item.real_size_m), pose);
    await uploadFile("glbs", path, out, "model/gltf-binary");
    log.info("ar model built", { item: item.id, sizeM: item.real_size_m, pose, bytes: out.length, ms: Math.round(performance.now() - started) });
  }
  return publicUrl("glbs", path);
}

/**
 * The whole shop as one AR model: every visible product at its real size and pose, in neat rows on the floor
 * (up to four a row, 6 cm apart), centred on the spot the customer taps.
 */
export async function buildShopArGlb(parts: Buffer[]): Promise<Buffer> {
  const nodeIO = await getIO();
  const target = new Document();
  const scene = target.createScene("shop");
  target.getRoot().setDefaultScene(scene);
  const docs = await Promise.all(parts.map((p) => nodeIO.readBinary(new Uint8Array(p))));

  const GAP = 0.06;
  const PER_ROW = 4;
  const sizes = docs.map((d) => {
    const b = getBounds(d.getRoot().getDefaultScene() ?? d.getRoot().listScenes()[0]!);
    return { w: b.max[0] - b.min[0], d: b.max[2] - b.min[2] };
  });
  // rows of up to PER_ROW, each centred, rows stacked front to back
  const rows: number[][] = [];
  sizes.forEach((_, i) => {
    if (i % PER_ROW === 0) rows.push([]);
    rows[rows.length - 1]!.push(i);
  });
  const rowDepth = rows.map((r) => Math.max(...r.map((i) => sizes[i]!.d)));
  const totalDepth = rowDepth.reduce((s, d) => s + d, 0) + GAP * (rows.length - 1);
  const offsets: [number, number][] = new Array(docs.length);
  let z = -totalDepth / 2;
  rows.forEach((r, ri) => {
    const width = r.reduce((s, i) => s + sizes[i]!.w, 0) + GAP * (r.length - 1);
    let x = -width / 2;
    for (const i of r) {
      offsets[i] = [x + sizes[i]!.w / 2, z + rowDepth[ri]! / 2];
      x += sizes[i]!.w + GAP;
    }
    z += rowDepth[ri]! + GAP;
  });

  docs.forEach((d, i) => {
    const map = mergeDocuments(target, d);
    const from = d.getRoot().getDefaultScene() ?? d.getRoot().listScenes()[0]!;
    const merged = map.get(from) as unknown as ReturnType<Document["createScene"]>;
    const holder = target.createNode(`product-${i}`).setTranslation([offsets[i]![0], 0, offsets[i]![1]]);
    for (const child of merged.listChildren()) {
      merged.removeChild(child);
      holder.addChild(child);
    }
    scene.addChild(holder);
    merged.dispose();
  });
  // one file for the whole set: 512 px textures are plenty at room scale (the geometry has a vertex per corner,
  // from texture seams, so simplifying it saves nothing; the bucket allows 15 MB)
  await target.transform(unpartition(), prune(), textureCompress({ encoder: sharp, targetFormat: "jpeg", resize: [512, 512], quality: 80 }));
  return Buffer.from(await nodeIO.writeBinary(target));
}

/** Public URL of the whole shop's AR model, built and stored once per set of products, sizes and poses. */
export async function shopArUrl(pageId: string, items: { id: string; glb_path: string | null; real_size_m: number | null; ar_pose?: string | null }[]): Promise<string | null> {
  const ready = items.filter((i) => i.glb_path && i.real_size_m);
  if (ready.length < 2) return null;
  const key = createHash("sha256")
    .update(ready.map((i) => `${i.id}:${Math.round(Number(i.real_size_m) * 1000)}:${i.ar_pose ?? "flat"}`).join("|"))
    .digest("hex")
    .slice(0, 16);
  const path = `ar/shop/${pageId}/${key}.glb`;
  const { data } = await supabaseAdmin().storage.from("glbs").list(`ar/shop/${pageId}`, { search: `${key}.glb` });
  if (!data?.length) {
    const started = performance.now();
    const parts = await Promise.all(
      ready.map(async (i) => {
        await arModelUrl(i);
        return downloadFile("glbs", arPath(i.id, Number(i.real_size_m), i.ar_pose === "upright" ? "upright" : "flat"));
      }),
    );
    const out = await buildShopArGlb(parts);
    await uploadFile("glbs", path, out, "model/gltf-binary");
    log.info("shop ar model built", { page: pageId, products: ready.length, bytes: out.length, ms: Math.round(performance.now() - started) });
  }
  return publicUrl("glbs", path);
}
