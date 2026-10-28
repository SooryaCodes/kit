// fal client for SAM 3D Objects (fal-ai/sam-3/3d-objects).
// Docs: https://fal.ai/models/fal-ai/sam-3/3d-objects/api

import { fal } from "@fal-ai/client";
import { secret } from "./env";

export const SAM_3D_OBJECTS = "fal-ai/sam-3/3d-objects";

let configured = false;

export function falClient(): typeof fal {
  if (!configured) {
    fal.config({ credentials: secret("FAL_KEY") });
    configured = true;
  }
  return fal;
}

export interface FalFile {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
}

export interface Sam3dObjectMetadata {
  object_index?: number;
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  camera_pose?: number[][];
}

export interface Sam3dObjectsInput {
  image_url: string;
  mask_urls?: string[];
  prompt?: string;
  seed?: number;
  export_textured_glb?: boolean;
  enable_safety_checker?: boolean;
}

export interface Sam3dObjectsOutput {
  gaussian_splat: FalFile;
  model_glb?: FalFile;
  metadata: Sam3dObjectMetadata[];
  individual_splats?: FalFile[];
  individual_glbs?: FalFile[];
  artifacts_zip?: FalFile;
}

/**
 * Uploads bytes to fal storage and returns a URL fal workers can read.
 * Uploads are free, so a network failure is retried a few times with backoff.
 * Callers should keep concurrency low: many parallel uploads hit connect timeouts.
 */
export async function uploadToFal(bytes: Buffer, contentType: string, name: string, attempts = 3): Promise<string> {
  const file = new File([new Uint8Array(bytes)], name, { type: contentType });
  for (let i = 1; ; i++) {
    try {
      return await falClient().storage.upload(file);
    } catch (err) {
      if (i >= attempts || (err as { status?: number }).status) throw err;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}
