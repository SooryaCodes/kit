# Architecture

## Flow

1. **Photo** (`/new`): one picture of several products. Sellers start on the product format, creators on "what's in my bag".
2. **Detect** (`/j/:id`): items outlined on the photo; the seller removes any that aren't for sale and confirms.
3. **Build** (`/j/:id`): each item turns into 3D as it finishes, live over Supabase Realtime.
4. **Shop editor** (`/j/:id/shop`): suggested names, descriptions and real sizes to check, prices, WhatsApp number or buy links, order, visibility, the Shop Manager panel, a live preview. Publish.
5. **Shop page** (`/k/:slug`): public, mobile first. Products in 3D, "See it in your room", "Ask about this product", order on WhatsApp.
6. **Reel** (`/j/:id/studio`): the same 3D products as a 1080×1920 MP4, made in the browser.
7. **My shops** (`/dashboard`): shop pages this browser can edit.

## Pipeline

| Step | Model / tool | Output |
|---|---|---|
| Resize and store photo | sharp, Supabase Storage | ~1536 px image |
| List items | Muse Spark Open on Baseten (fallback Muse Spark, Meta Model API) | names, categories, noun phrases, rough boxes |
| Segment | SAM 3.1 (Meta Model API), box prompts | one mask per item, de-duplicated |
| Reconstruct | SAM 3D Objects (Meta open weights via fal queue, one request per item, webhook + sync backstop) | GLB per item |
| Optimize | gltf-transform: weld, simplify, normals, WebP, meshopt | ~200 to 700 KB GLB |
| Product details | Muse Spark, one structured-output call per photo | name, description, longest side in cm, confidence |
| Real-size AR copy | gltf-transform, on first request | plain glTF in metres, resting on the floor, JPEG textures |
| Backdrop and pictures | Muse Image (one backdrop per shop) + sharp | styled product photo; true-size picture next to a phone, A4 sheet or laptop drawn to the same scale |
| Customer questions | Muse Wonder, structured output | short answer, sure / not sure, optional WhatsApp order message |
| Shop Manager | Muse Wonder with function tools (`get_shop`, `get_metrics`, `get_questions`, `propose_action`) | report text + at most three proposals |
| Price check | Muse Spark, Responses API with `web_search` | range + cited pages; hidden unless two sources back it |
| Reel | react-three-fiber + canvas-record (WebCodecs) | MP4 |

A photo that already has a finished run (the sample photos, or the same picture uploaded again) replays that run: same items, masks and models, paced like a live run, with no model calls.

## Data model

Supabase Postgres, migrations in `supabase/migrations/`.

- `jobs`: photo, template, status, per-step timings and cost
- `items`: per product: name, box, mask, crop, GLB, status, price, description, confirmed real size, offer badge, size picture, styled photo, order, hidden
- `pages`: a published shop: slug, mode (shop or creator), title, handle, WhatsApp number, published
- `page_secrets`: edit token hashes (server only)
- `events`: anonymous visits, 3D opens, AR opens, questions and order taps per product
- `conversations`: customer questions and answers per anonymous visitor
- `agent_reports`, `agent_actions`: Shop Manager reports, every proposal and the seller's decision with its time
- `reels`, `model_cache`, `api_spend`, `job_requests`

No accounts. Creating a shop page returns an edit token once; the browser keeps it, the database keeps only its hash, and every edit, report and approval must carry it. Drafts are visible only with the token.

Row level security is on for every table. The public can read published pages and insert events for them; conversations, reports, actions and secrets are server only.

## Cost controls

Every paid call goes through `lib/budget.ts`: per-provider caps, a per-job cap, item and job limits, a kill switch (`AI_DISABLED`), a cache-only mode (`MOCK_AI`), one retry on network or 5xx errors, and a row in `api_spend` per call. On top of that:

- Customer questions are capped per page and per visitor per day (about 1 cent each on Muse Wonder).
- Shop Manager reports are capped per page per day (about 3 cents each).
- Replays of finished photos cost nothing and don't count toward caps.
- Model responses are cached by input hash in the database, so repeat work is free.
- Standard tier only; contributor-tier model IDs are refused.

## Principles

- The product in every picture is the real cut-out; generated imagery is only ever the background.
- Size and fit come only from what the seller confirmed.
- Nothing the Shop Manager proposes changes the page until the seller approves it.
- Never show a price without a real source link.
