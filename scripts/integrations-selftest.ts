// Exercises the store integrations with fixed inputs: no network, no spend.
//   pnpm test:integrations

import assert from "node:assert/strict";

async function main() {
  process.env.LOG_LEVEL = "warn";
  const { storeOrigin, shortTitle, cellFor, isShopifySource, ImportError } = await import("../lib/shop/shopify");
  const { csvCell } = await import("../lib/shop/catalog");
  const { CATEGORIES } = await import("../lib/shop/taxonomy");

  // store addresses: whatever a seller pastes becomes the https origin, nothing else gets through
  assert.equal(storeOrigin("boat-lifestyle.com"), "https://boat-lifestyle.com");
  assert.equal(storeOrigin("  https://WWW.Snitch.co.in/collections/new?x=1 "), "https://www.snitch.co.in");
  assert.equal(storeOrigin("http://shop.example.myshopify.com/products/a"), "https://shop.example.myshopify.com");
  for (const bad of ["", "not a url", "localhost", "http://127.0.0.1:3000", "10.0.0.1", "https://intranet/", "javascript:alert(1)"]) {
    assert.throws(() => storeOrigin(bad), ImportError, `should refuse ${JSON.stringify(bad)}`);
  }

  // titles: the part before a separator, whole words only
  assert.equal(shortTitle("boAt Stone 180 | Bluetooth Speaker with 5W sound"), "boAt Stone 180");
  assert.equal(shortTitle("Linen Shirt – Olive"), "Linen Shirt");
  assert.equal(shortTitle("Plain Tote"), "Plain Tote");
  const long = shortTitle("Handwoven Cotton Table Runner With Tassels For Dining Tables And Festive Occasions At Home");
  assert.ok(long.length <= 60 && !long.endsWith(" ") && "Handwoven Cotton Table Runner With Tassels For Dining Tables And".startsWith(long), long);

  // grid cells: a box is matched by its centre, on the photo as stored (possibly scaled down)
  const product = { title: "A", price: 100, description: "", url: "https://s.com/products/a" };
  const source = {
    kind: "shopify" as const,
    store: { name: "S", url: "https://s.com", city: null, currency: "INR" },
    width: 1380,
    height: 720,
    cells: [
      { x: 60, y: 60, w: 600, h: 600, product },
      { x: 720, y: 60, w: 600, h: 600, product: { ...product, title: "B" } },
    ],
  };
  assert.equal(cellFor(source, { left: 100, top: 100, right: 300, bottom: 300 }, 1380)?.product.title, "A");
  assert.equal(cellFor(source, { left: 800, top: 200, right: 1200, bottom: 500 }, 1380)?.product.title, "B");
  // the same box on a copy stored at half width
  assert.equal(cellFor(source, { left: 400, top: 100, right: 600, bottom: 250 }, 690)?.product.title, "B");
  assert.equal(cellFor(source, { left: 0, top: 690, right: 20, bottom: 715 }, 1380), null);
  assert.ok(isShopifySource(source));
  assert.ok(!isShopifySource(null) && !isShopifySource({ kind: "photo" }));

  // CSV cells: quotes, commas and line breaks survive a round trip
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell('Fits a 14" laptop, and more'), '"Fits a 14"" laptop, and more"');
  assert.equal(csvCell("two\nlines"), '"two\nlines"');

  // categories: unique ids, two levels at most, the ones the sample shop needs are there
  assert.equal(new Set(CATEGORIES.map(([id]) => id)).size, CATEGORIES.length);
  assert.ok(CATEGORIES.every(([, path]) => path.split(" > ").length <= 2));
  assert.ok(CATEGORIES.some(([id, path]) => id === 6551 && path === "Apparel & Accessories > Handbags, Wallets & Cases"));

  // USDZ for iPhone: stored (never compressed), every file's data 64-byte aligned, the scene first,
  // metres and Y up, the glTF's node transform baked into the points and its v coordinate flipped
  const { Document, NodeIO } = await import("@gltf-transform/core");
  const { glbToUsdz } = await import("../lib/shop/usdz");
  const doc = new Document();
  doc.createBuffer();
  const tri = doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])))
    .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array([0, 0, 1, 0, 0, 1])))
    .setMaterial(doc.createMaterial().setBaseColorTexture(doc.createTexture().setMimeType("image/jpeg").setImage(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))));
  doc.createScene().addChild(doc.createNode().setTranslation([0, 0.5, 0]).setMesh(doc.createMesh().addPrimitive(tri)));
  const usdz = await glbToUsdz(Buffer.from(await new NodeIO().writeBinary(doc)));
  const names: string[] = [];
  for (let at = 0; usdz.readUInt32LE(at) === 0x04034b50; ) {
    const size = usdz.readUInt32LE(at + 18);
    const nameLen = usdz.readUInt16LE(at + 26);
    const data = at + 30 + nameLen + usdz.readUInt16LE(at + 28);
    names.push(usdz.subarray(at + 30, at + 30 + nameLen).toString());
    assert.equal(usdz.readUInt16LE(at + 8), 0, "usdz files must be stored, not compressed");
    assert.equal(data % 64, 0, `${names.at(-1)} must start on a 64-byte boundary`);
    at = data + size;
  }
  assert.deepEqual(names, ["model.usda", "textures/t0.jpg"]);
  const usda = usdz.subarray(usdz.indexOf("#usda"), usdz.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), 1)).toString();
  assert.match(usda, /metersPerUnit = 1/);
  assert.match(usda, /upAxis = "Y"/);
  assert.match(usda, /point3f\[\] points = \[\(0, 0.5, 0\), \(1, 0.5, 0\), \(0, 1.5, 0\)\]/);
  assert.match(usda, /primvars:st = \[\(0, 1\), \(1, 1\), \(0, 0\)\]/);
  assert.match(usda, /asset inputs:file = @textures\/t0.jpg@/);

  console.log("integrations self-test passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
