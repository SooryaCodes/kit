// fal client for SAM 3D Objects (fal-ai/sam-3/3d-objects).
// Docs: https://fal.ai/models/fal-ai/sam-3/3d-objects/api

import { fal } from "@fal-ai/client";
import { env } from "./env";

export const SAM_3D_OBJECTS = "fal-ai/sam-3/3d-objects";

let configured = false;

export function falClient(): typeof fal {
  if (!configured) {
    fal.config({ credentials: env("FAL_KEY") });
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

/** Uploads bytes to fal storage and returns a URL fal workers can read. */
export async function uploadToFal(bytes: Buffer, contentType: string, name: string): Promise<string> {
  const blob = new Blob([new Uint8Array(bytes)], { type: contentType });
  return falClient().storage.upload(new File([blob], name, { type: contentType }));
}
