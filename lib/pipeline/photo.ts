// Load a photo, apply EXIF rotation, and resize so the long side is at most `maxSide`.

import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { hash } from "../cache";
import type { SamImage } from "../sam";

export interface Photo extends SamImage {
  bytes: Buffer;
  originalWidth: number;
  originalHeight: number;
}

export async function loadPhoto(file: string, maxSide = 1536): Promise<Photo> {
  const input = await readFile(file);
  const meta = await sharp(input).rotate().metadata();
  const bytes = await sharp(input)
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  const out = await sharp(bytes).metadata();
  if (!out.width || !out.height) throw new Error(`Could not read size of ${file}`);
  return {
    bytes,
    width: out.width,
    height: out.height,
    originalWidth: meta.autoOrient?.width ?? meta.width ?? out.width,
    originalHeight: meta.autoOrient?.height ?? meta.height ?? out.height,
    hash: hash(bytes),
    dataUrl: `data:image/jpeg;base64,${bytes.toString("base64")}`,
  };
}
