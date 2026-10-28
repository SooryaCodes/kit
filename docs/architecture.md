# Architecture

## User flow

1. **Home**: choose a template (Bag, Desk, Fit, Collection, Seller Drop)
2. **Upload**: one photo
3. **Detect**: items outlined on the photo; tap to remove / add; confirm
4. **Build**: items lift into 3D one by one with live progress
5. **Studio**: 3D scene, editable labels (name, brand, price, link), animation preset, themed world
6. **Export**: 1080×1920 MP4 + shareable interactive 3D page

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

Supabase Postgres, migrations in `supabase/migrations/`.

- `jobs`: photo, template, status, per-step timings, per-step cost
- `items`: job, name, phrase, box, mask, crop, glb, status, fal request id, brand, model, price, link, confidence, fallback
- `reels`: job, mp4, cover, world, preset, share slug
- `model_cache`: model responses keyed by input hash
- `api_spend`: one row per paid model call (provider, model, USD, job)
- `job_requests`: hashed client IPs for rate limiting

Storage buckets: `photos`, `masks` and `crops` are private and read through 1 hour signed URLs made by the server; `glbs`, `reels` and `covers` are public, with uuid-based paths. Only the server (service role) can upload.
Row level security is on for every table: the public can read jobs, items and reels by id; everything else is server only.
Live progress: the build screen subscribes to `items` (and `jobs`) changes for its job over Supabase Realtime.

## Cost controls

Every paid call (Meta Model API, Baseten, fal) goes through `lib/budget.ts`:

- Per-provider spend caps, a per-job cap, max items per job and max jobs per day, all set by env.
- `AI_DISABLED=true` stops all paid calls; `MOCK_AI=true` serves cached responses only.
- One retry at most, only on network errors and 5xx. fal jobs are submitted once and resumed by request id, never re-submitted.
- Every call is logged with its cost and written to `api_spend`. `GET /api/admin/spend` (bearer `ADMIN_TOKEN`) shows totals against caps.
- Job creation is limited per IP per hour.
- Standard tier only. Contributor-tier models, which allow training on inputs, are refused.

## Principles

- Every model call is cached by input hash. A cache hit costs nothing.
- Every pipeline step logs with levels (debug/info/warn/error) and records timing + cost.
- Long-running work (3D reconstruction) runs through a queue + webhooks, never inside a request.
- Never show a price without a real source link.
