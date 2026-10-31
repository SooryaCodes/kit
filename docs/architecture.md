# Architecture

## Flow

1. **Photo** (`/new`): one picture of several products, or a Shopify store address (`POST /api/import/shopify`).
2. **Studio** (`/studio/:jobId`), one screen from photo to live link:
   - Finding: products outlined on the photo; the seller unticks any that aren't for sale and fixes names.
   - Building: each product lifts into 3D on the photo as it finishes, live over Supabase Realtime.
   - Products: suggested names, descriptions and real sizes to check, prices, pose (stands up or lies flat), offer badge, sold out, order, visibility. A QR code (or, on a phone, a button) to try it in your own room, and the embed code.
   - Shop page: handle, WhatsApp number, address, buyer details (about, city, delivery, returns, cash on delivery), the catalog feed link, the private edit link, and the page on a phone frame.
   - Insights: visits, 3D and AR opens, questions, order taps, and the Shop Manager.
   - Edits save as you type; Publish makes the page public, and a live page's top button shares it.
3. **Shop page** (`/k/:slug`): public, mobile first. Products in 3D, See it in your room (one product or the whole shop), Ask about this product, buyer details, Order on WhatsApp. `?p=<id>` opens a product.
4. **Embed** (`/k/:slug/embed/:itemId`): one product in 3D for another store's product page, as an iframe.
5. **My shops** (`/dashboard`): shop pages this browser can edit. An edit link (`/studio/:jobId#key=…`) adds a shop on another device.

## Pipeline

| Step | Model / tool | Output |
|---|---|---|
| Resize and store photo | sharp, Supabase Storage | ~1536 px image |
| List items | Muse Spark Open on Baseten (fallback Muse Spark, Meta Model API) | names, categories, noun phrases, rough boxes |
| Segment | SAM 3.1 (Meta Model API), box prompts | one mask per item, de-duplicated |
| Reconstruct | SAM 3D Objects (Meta open weights via fal queue, one request per item, webhook + sync backstop) | GLB per item |
| Optimize | gltf-transform: weld, simplify, normals, WebP, meshopt | ~200 to 700 KB GLB |
| Product details | Muse Spark, one structured-output call per photo | name, description, longest side in cm, confidence |
| Real-size AR copy | gltf-transform, at publish or first request | plain glTF in metres, resting on the floor, lying flat or standing up, JPEG textures |
| iPhone AR | `lib/shop/usdz.ts`, from the AR copy | USDZ: one `.usda` scene and its textures, uncompressed and 64-byte aligned, metres, Y up |
| Whole shop in AR | gltf-transform `mergeDocuments` | every AR copy in one GLB (and USDZ), rows of four, 6 cm apart |
| Catalog category | Muse Spark, structured output limited to the Google product taxonomy's first two levels | one category id per product, stored |
| Catalog feed | `lib/shop/catalog.ts` | Meta catalog CSV; products without a styled photo get their cut-out on white, 1080 px |
| Shopify import | `lib/shop/shopify.ts`: `/products.json`, `/meta.json`, sharp | a grid photo of up to 12 products on white; each product found is matched back to its cell for its name, price, description and link |
| Backdrop and pictures | Muse Image (one backdrop per shop) + sharp | styled product photo; true-size picture next to a phone, A4 sheet or laptop drawn to the same scale |
| Customer questions | Muse Wonder, structured output | short answer, sure / not sure, optional WhatsApp order message |
| Shop Manager | Muse Wonder with function tools (`get_shop`, `get_metrics`, `get_questions`, `propose_action`) | report text + at most three proposals |
| Price check | Muse Spark, Responses API with `web_search` | range + cited pages; hidden unless two sources back it |

A photo that already has a finished run (the sample photos, or the same picture uploaded again) replays that run: same items, masks and models, paced like a live run, with no model calls.

## Data model

Supabase Postgres, migrations in `supabase/migrations/`.

- `jobs`: photo, template, status, per-step timings and cost, and `source` when Kit composed the photo (a Shopify grid)
- `items`: per product: name, box, mask, crop, GLB, status, price, description, confirmed real size, AR pose, offer badge, sold out, size picture, styled photo, catalog category and image, order, hidden
- `pages`: a shop: slug, mode (shop or creator), title, handle, WhatsApp number, about, city, delivery, returns, cash on delivery, published
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

## Checks

- `pnpm test:budget`: spend caps, retries and per-job limits with fake calls.
- `pnpm test:integrations`: store addresses, Shopify title and grid matching, CSV escaping, the category list, and USDZ packaging rules.
- `pnpm check:catalog <feed url>`: reads a feed as Meta's scheduled fetch does and checks every row against Meta's catalog reference, fetching each image and link.

## Principles

- The product in every picture is the real cut-out; generated imagery is only ever the background.
- Size and fit come only from what the seller confirmed.
- Nothing the Shop Manager proposes changes the page until the seller approves it.
- Never show a price without a real source link.
