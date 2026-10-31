// Checks a product catalog feed the way Meta's scheduled fetch reads it, against the rules in
// https://developers.facebook.com/docs/marketing-api/catalog/reference : required columns, field formats and
// lengths, and every image and product link fetched (images must be JPEG or PNG, at least 500 x 500, at most 8 MB).
//   pnpm check:catalog https://kit-flame-beta.vercel.app/api/k/sample-shop/catalog.csv

import sharp from "sharp";
import { CATEGORIES } from "../lib/shop/taxonomy";

const REQUIRED = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand"] as const;
const CATEGORY_IDS = new Set(CATEGORIES.map(([id]) => id));

/** RFC 4180: quoted cells may hold commas, doubled quotes and line breaks. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

async function checkImage(url: string): Promise<string | null> {
  if (!/^https:\/\//.test(url)) return "is not an https URL";
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return `answered ${res.status}`;
  const type = res.headers.get("content-type") ?? "";
  if (!/^image\/(jpeg|png)/.test(type)) return `is ${type || "of unknown type"}, not JPEG or PNG`;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024) return `is ${(bytes.length / 1048576).toFixed(1)} MB, over 8 MB`;
  const meta = await sharp(bytes).metadata();
  if ((meta.width ?? 0) < 500 || (meta.height ?? 0) < 500) return `is ${meta.width} x ${meta.height}, under 500 x 500`;
  return null;
}

async function checkLink(url: string): Promise<string | null> {
  if (!/^https?:\/\//.test(url)) return "doesn't start with http:// or https://";
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  return res.ok ? null : `answered ${res.status}`;
}

async function main() {
  const url = process.argv[2];
  if (!url) throw new Error("usage: pnpm check:catalog <feed url>");
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  const errors: string[] = [];
  if (!res.ok) throw new Error(`the feed answered ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("text/csv")) errors.push(`feed content-type is "${type}", expected text/csv`);

  const [header, ...rows] = parseCsv(await res.text()).filter((r) => r.some((c) => c !== ""));
  if (!header) throw new Error("the feed is empty");
  for (const col of REQUIRED) if (!header.includes(col)) errors.push(`missing required column ${col}`);
  if (!header.includes("google_product_category") && !header.includes("fb_product_category")) errors.push("missing google_product_category or fb_product_category");
  const at = (r: string[], col: string) => r[header.indexOf(col)] ?? "";

  const ids = new Set<string>();
  await Promise.all(
    rows.map(async (r, n) => {
      const where = `row ${n + 2} (${at(r, "title") || "untitled"})`;
      const bad = (msg: string) => errors.push(`${where}: ${msg}`);
      if (r.length !== header.length) bad(`has ${r.length} cells, the header has ${header.length}`);
      const id = at(r, "id");
      if (!id || id.length > 100) bad("id is empty or over 100 characters");
      if (ids.has(id)) bad(`id ${id} repeats, so Meta ignores every copy`);
      ids.add(id);
      const title = at(r, "title");
      if (!title || title.length > 200) bad("title is empty or over 200 characters");
      const description = at(r, "description");
      if (!description || description.length > 9999) bad("description is empty or over 9,999 characters");
      if (/<[a-z/][^>]*>/i.test(description)) bad("description has HTML");
      if (/https?:\/\//.test(description)) bad("description has a link");
      if (description === title) bad("description is the same as the title");
      if (description.length > 20 && description === description.toUpperCase()) bad("description is all capitals");
      if (!["in stock", "out of stock"].includes(at(r, "availability"))) bad(`availability "${at(r, "availability")}" is not "in stock" or "out of stock"`);
      if (!["new", "refurbished", "used"].includes(at(r, "condition"))) bad(`condition "${at(r, "condition")}" is not allowed`);
      if (!/^\d+(\.\d{1,2})? [A-Z]{3}$/.test(at(r, "price"))) bad(`price "${at(r, "price")}" is not like "9.99 USD"`);
      const brand = at(r, "brand");
      if (!brand || brand.length > 100) bad("brand is empty or over 100 characters");
      const category = at(r, "google_product_category");
      if (category && !CATEGORY_IDS.has(Number(category))) bad(`google_product_category ${category} is not in the taxonomy`);
      if (!category && !at(r, "fb_product_category")) bad("has no product category");
      const image = await checkImage(at(r, "image_link"));
      if (image) bad(`image_link ${image}`);
      for (const extra of at(r, "additional_image_link").split(/[,;| ]+/).filter(Boolean)) {
        const problem = await checkImage(extra);
        if (problem) bad(`additional_image_link ${problem}`);
      }
      const link = await checkLink(at(r, "link"));
      if (link) bad(`link ${link}`);
    }),
  );

  console.log(`${rows.length} products, ${header.length} columns: ${header.join(", ")}`);
  if (errors.length) {
    console.log(`\n${errors.length} problems:\n${errors.map((e) => `  ${e}`).join("\n")}`);
    process.exit(1);
  }
  console.log("Every product meets Meta's catalog rules: required fields, formats, images and links.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
