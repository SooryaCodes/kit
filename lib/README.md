# lib: model clients and pipeline steps

Endpoints, model IDs and shapes below were read from each provider's docs. Items marked *measured* were confirmed against live responses.

## Meta Model API (`meta.ts`)

- Base URL `https://api.meta.ai/v1`, `Authorization: Bearer <key>`. OpenAI SDK compatible.
- Models: `muse-spark-1.3` (text/vision, 1M context), `sam-3.1` (segmentation), `muse-image-1.0` (image gen/edit).
- Chat Completions: `POST /v1/chat/completions`. Images as `{type:"image_url", image_url:{url}}`, public URL or `data:` URL, up to 50 per request, 50 MB each.
- Structured output: `response_format: {type:"json_schema", json_schema:{name, schema}}`. Decoding is constrained. No recursive schemas.
- Reasoning: top-level `reasoning_effort` (`minimal` to `max`) on Chat Completions; `reasoning.effort` on Responses.
- Grounding coordinates from Muse Spark use a 0 to 1000 grid, `(0,0)` top-left.
- Pricing: Muse Spark $1.25 in / $0.15 cached / $4.25 out per 1M tokens. SAM 3.1 $2.50 per 1,000 images. Muse Image $0.01 per image.
- Rate limits per team: Muse Spark 3,000 RPM, SAM 3.1 3,000 RPM, Muse Image 150 RPM.

## SAM 3.1 (`sam.ts`)

- Responses API: `POST /v1/responses`, `model: "sam-3.1"`, one user message with an `input_text` prompt and an `input_image` (`image_url` string).
- Prompt is either one short noun phrase (every match returned) or box/point tokens for up to 16 objects, never both. Lists like `"a, b"` return nothing; send one request per concept.
- `metadata` (string values): `include_confidence: "true"`, `mask_encoding: "one_bit" | "lossless"`.
- Output is token text in `output_text`: `<0f>id<|box;x1;y1;x2;y2;w;h;c|><|mask;x=0;y=0;c;data=H,W,!payload|>,...`. Zero matches is a normal, empty result.
- Parsed with `@meta-sam/parser` (`parseImageStream`, `recordsOfKind`, `decodeMaskToRaster`, `buildObjectPrompt`). Each mask record has `bounds`: the half-open source-pixel box its raster covers.

## Muse Spark Open on Baseten (`baseten.ts`)

- Base URL `https://inference.baseten.co/v1`, OpenAI-compatible Chat Completions.
- Images via `image_url` (`detail`: `low | high | original | auto`), up to 10 MB per image by URL.
- Reasoning is always on; no `reasoning_effort` control.
- No `response_format` / JSON mode for this model. Tool calling is supported, so structured results use a forced tool call (`tool_choice: {type:"function", function:{name}}`) validated with zod.
- Pricing $1.25 in / $0.15 cached / $4.25 out per 1M tokens.

## SAM 3D Objects on fal (`fal.ts`, `pipeline/reconstruct.ts`)

- Endpoint `fal-ai/sam-3/3d-objects` through the fal queue (`fal.subscribe`, or `webhookUrl` for async).
- Input: `image_url` (required), `mask_urls[]` (one binary mask per object, white = object), `prompt`, `point_prompts[]`, `box_prompts[]`, `seed`, `export_textured_glb` (baked texture + UVs instead of vertex colours), `enable_safety_checker`.
- Output: `model_glb` (combined scene), `individual_glbs[]` and `individual_splats[]` (multi-object only), `gaussian_splat` (.ply), `metadata[]` (`object_index`, `translation`, `rotation` quaternion, `scale`, `camera_pose`), `artifacts_zip`.
- Pricing $0.02 per call. Docs list 4 to 8 s per object; 60 s+ timeouts for 2048px inputs.
- Weak cases: transparent or reflective materials, baked hard shadows, heavy occlusion, under 512px input. No absolute scale.

## Pipeline (`pipeline/`)

`photo.ts` resize · `list-items.ts` item list · `masks.ts` assignment, IoU dedupe, mask PNGs, cutouts · `reconstruct.ts` 3D · `optimize.ts` gltf-transform (dedup, weld, simplify, WebP 512, meshopt).
