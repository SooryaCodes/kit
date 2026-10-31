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

  console.log("integrations self-test passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
