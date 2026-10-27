# Architecture

## User flow

1. **Home** — choose a template (Bag, Desk, Fit, Collection, Seller Drop)
2. **Upload** — one photo
3. **Detect** — items outlined on the photo; tap to remove / add; confirm
4. **Build** — items lift into 3D one by one with live progress
5. **Studio** — 3D scene, editable labels (name, brand, price, link), animation preset, themed world
6. **Export** — 1080×1920 MP4 + shareable interactive 3D page

## Pipeline

| Step | Model / tool | Output |
|---|---|---|
| Resize & store photo | sharp, Supabase Storage | ~1536px image |
| List items | Muse Spark (open weights via Baseten; fallback Meta Model API) | JSON list: name, category, noun phrase, approx box |
| Segment | SAM 3.1 (Meta Model API), one call per noun phrase | mask per item, de-duplicated by IoU |
| Confirm | UI | user-edited item list |
| Reconstruct | SAM 3D Objects (fal queue, parallel) | GLB per item |
| Optimize | gltf-transform (weld, simplify, meshopt, WebP) | <1 MB GLB per item |
| Identify | Muse Spark (Meta Model API) | brand, model, price, link, confidence |
| Theme | Muse Image (Meta Model API) | template world + cover |
| Render | react-three-fiber | animated scene |
| Export | canvas-record (WebCodecs) | MP4 |

**Fallbacks:** low-quality reconstruction → 2.5D cutout card from the mask · browser export unavailable → WebM.

## Data model

- `jobs` — photo, template, status, per-step timings, per-step cost
- `items` — job, name, phrase, mask, glb, status, brand, model, price, link, confidence, fallback
- `reels` — job, mp4, preset, share slug

## Principles

- Every model call is cached by input hash.
- Every pipeline step logs with levels (debug/info/warn/error) and records timing + cost.
- Long-running work (3D reconstruction) runs through a queue + webhooks, never inside a request.
- Never show a price without a real source link.
