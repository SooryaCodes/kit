// Shrink a GLB for the web: dedup, weld, simplify to a triangle budget,
// WebP textures at 512px, meshopt compression. Client decodes with MeshoptDecoder.
// SAM 3D Objects GLBs ship without normals (lit materials render black), so we add them.

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, getBounds, meshopt, normals, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

export interface OptimizeResult {
  glb: Buffer;
  bytesBefore: number;
  bytesAfter: number;
  trianglesBefore: number;
  trianglesAfter: number;
  hasTexture: boolean;
  vertexColors: boolean;
  /** size of the axis-aligned bounds, in model units */
  size: [number, number, number];
}

let io: NodeIO | undefined;

async function getIO(): Promise<NodeIO> {
  if (!io) {
    await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      "meshopt.decoder": MeshoptDecoder,
      "meshopt.encoder": MeshoptEncoder,
    });
  }
  return io;
}

function countTriangles(doc: Awaited<ReturnType<NodeIO["readBinary"]>>): number {
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute("POSITION");
      tris += Math.floor((idx ? idx.getCount() : (pos?.getCount() ?? 0)) / 3);
    }
  }
  return tris;
}

export async function optimizeGlb(input: Buffer, targetTriangles = 5000): Promise<OptimizeResult> {
  const nodeIO = await getIO();
  const doc = await nodeIO.readBinary(new Uint8Array(input));
  const trianglesBefore = countTriangles(doc);
  const hasTexture = doc.getRoot().listTextures().length > 0;
  const vertexColors = doc
    .getRoot()
    .listMeshes()
    .some((m) => m.listPrimitives().some((p) => Boolean(p.getAttribute("COLOR_0"))));

  const ratio = trianglesBefore > targetTriangles ? targetTriangles / trianglesBefore : 1;
  await doc.transform(
    dedup(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002 }),
    normals({ overwrite: false }),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [512, 512], quality: 85 }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );

  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const b = scene ? getBounds(scene) : { min: [0, 0, 0], max: [0, 0, 0] };
  const glb = Buffer.from(await nodeIO.writeBinary(doc));
  return {
    glb,
    bytesBefore: input.length,
    bytesAfter: glb.length,
    trianglesBefore,
    trianglesAfter: countTriangles(doc),
    hasTexture,
    vertexColors,
    size: [b.max[0]! - b.min[0]!, b.max[1]! - b.min[1]!, b.max[2]! - b.min[2]!].map((v) => Math.round(v * 1000) / 1000) as [number, number, number],
  };
}
