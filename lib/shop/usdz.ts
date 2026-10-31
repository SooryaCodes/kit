// USDZ for iPhone AR Quick Look, written on the server from the same real-size glTF Android uses.
// Without one, the browser converts the model on the tap and hands Quick Look a blob URL, which is where
// iPhones fall back to "Object" with AR greyed out. A USDZ is a zip that must be uncompressed with every file
// 64-byte aligned, holding one text scene (.usda) first and its textures. Units are metres, Y up, as in glTF.

import "server-only";
import { type Document, type Mesh, type Node, NodeIO } from "@gltf-transform/core";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A stored (uncompressed) zip with each file's data starting on a 64-byte boundary, as USDZ requires. */
export function usdzZip(files: { name: string; data: Uint8Array }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data);
    let pad = (64 - ((offset + 30 + name.length) % 64)) % 64;
    if (pad > 0 && pad < 4) pad += 64; // an extra field needs at least its 4-byte header
    const extra = Buffer.alloc(pad);
    if (pad) {
      extra.writeUInt16LE(0x1986, 0); // padding block, the id Pixar's own writer uses
      extra.writeUInt16LE(pad - 4, 2);
    }
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(extra.length, 28);
    parts.push(local, name, extra, Buffer.from(f.data));

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(f.data.length, 20);
    entry.writeUInt32LE(f.data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += 30 + name.length + extra.length + f.data.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}

type Mat4 = number[];

function apply(m: Mat4, x: number, y: number, z: number, w: number): [number, number, number] {
  return [m[0]! * x + m[4]! * y + m[8]! * z + m[12]! * w, m[1]! * x + m[5]! * y + m[9]! * z + m[13]! * w, m[2]! * x + m[6]! * y + m[10]! * z + m[14]! * w];
}

const f = (n: number, digits: number) => {
  const s = n.toFixed(digits).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
};

function meshNodes(doc: Document): { node: Node; mesh: Mesh }[] {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const out: { node: Node; mesh: Mesh }[] = [];
  scene?.traverse((node) => {
    const mesh = node.getMesh();
    if (mesh) out.push({ node, mesh });
  });
  return out;
}

/** The glTF's meshes, baked into place, as one USDZ with a UsdPreviewSurface material per primitive. */
export async function glbToUsdz(glb: Buffer): Promise<Buffer> {
  const doc = await new NodeIO().readBinary(new Uint8Array(glb));
  const textures: { name: string; data: Uint8Array }[] = [];
  const textureNames = new Map<object, string>();
  const meshes: string[] = [];
  const materials: string[] = [];
  let n = 0;

  for (const { node, mesh } of meshNodes(doc)) {
    const world = node.getWorldMatrix() as unknown as Mat4;
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute("POSITION");
      if (!position || prim.getMode() !== 4) continue; // triangles only
      const normal = prim.getAttribute("NORMAL");
      const uv = prim.getAttribute("TEXCOORD_0");
      const count = position.getCount();
      const indices = prim.getIndices();
      const index = indices ? Array.from(indices.getArray()!) : Array.from({ length: count }, (_, i) => i);
      const el: number[] = [];

      const points: string[] = [];
      const normals: string[] = [];
      const st: string[] = [];
      for (let i = 0; i < count; i++) {
        position.getElement(i, el);
        const p = apply(world, el[0]!, el[1]!, el[2]!, 1);
        points.push(`(${f(p[0], 5)}, ${f(p[1], 5)}, ${f(p[2], 5)})`);
        if (normal) {
          normal.getElement(i, el);
          const q = apply(world, el[0]!, el[1]!, el[2]!, 0);
          const len = Math.hypot(q[0], q[1], q[2]) || 1;
          normals.push(`(${f(q[0] / len, 3)}, ${f(q[1] / len, 3)}, ${f(q[2] / len, 3)})`);
        }
        if (uv) {
          uv.getElement(i, el);
          st.push(`(${f(el[0]!, 4)}, ${f(1 - el[1]!, 4)})`); // glTF's v runs down the image, USD's up
        }
      }

      const name = `Part${n}`;
      const mat = `Mat${n}`;
      const material = prim.getMaterial();
      const texture = material?.getBaseColorTexture();
      const factor = material?.getBaseColorFactor() ?? [1, 1, 1, 1];
      let texName: string | undefined;
      if (texture && uv) {
        texName = textureNames.get(texture);
        if (!texName) {
          texName = `textures/t${textureNames.size}.${texture.getMimeType() === "image/png" ? "png" : "jpg"}`;
          textureNames.set(texture, texName);
          textures.push({ name: texName, data: texture.getImage()! });
        }
      }
      const base = `/Root/Materials/${mat}`;
      materials.push(`        def Material "${mat}"
        {
            token outputs:surface.connect = <${base}/Surface.outputs:surface>

            def Shader "Surface"
            {
                uniform token info:id = "UsdPreviewSurface"
                ${texName ? `color3f inputs:diffuseColor.connect = <${base}/Color.outputs:rgb>` : `color3f inputs:diffuseColor = (${f(factor[0]!, 4)}, ${f(factor[1]!, 4)}, ${f(factor[2]!, 4)})`}
                float inputs:metallic = 0
                float inputs:roughness = 0.75
                token outputs:surface
            }
${
  texName
    ? `
            def Shader "Reader"
            {
                uniform token info:id = "UsdPrimvarReader_float2"
                string inputs:varname = "st"
                float2 outputs:result
            }

            def Shader "Color"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @${texName}@
                float2 inputs:st.connect = <${base}/Reader.outputs:result>
                float4 inputs:scale = (${f(factor[0]!, 4)}, ${f(factor[1]!, 4)}, ${f(factor[2]!, 4)}, 1)
                token inputs:wrapS = "repeat"
                token inputs:wrapT = "repeat"
                token inputs:sourceColorSpace = "sRGB"
                float3 outputs:rgb
            }`
    : ""
}
        }`);

      meshes.push(`    def Mesh "${name}" (
        prepend apiSchemas = ["MaterialBindingAPI"]
    )
    {
        uniform bool doubleSided = 1
        int[] faceVertexCounts = [${new Array(index.length / 3).fill(3).join(", ")}]
        int[] faceVertexIndices = [${index.join(", ")}]
        rel material:binding = <${base}>
        point3f[] points = [${points.join(", ")}]${
          normals.length
            ? `
        normal3f[] normals = [${normals.join(", ")}] (
            interpolation = "vertex"
        )`
            : ""
        }${
          st.length
            ? `
        texCoord2f[] primvars:st = [${st.join(", ")}] (
            interpolation = "vertex"
        )`
            : ""
        }
        uniform token subdivisionScheme = "none"
    }`);
      n++;
    }
  }
  if (!meshes.length) throw new Error("the model has no triangle meshes");

  const usda = `#usda 1.0
(
    defaultPrim = "Root"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "Root" (
    kind = "component"
)
{
${meshes.join("\n\n")}

    def Scope "Materials"
    {
${materials.join("\n\n")}
    }
}
`;
  return usdzZip([{ name: "model.usda", data: Buffer.from(usda, "utf8") }, ...textures]);
}
