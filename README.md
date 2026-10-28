# Kit

**Take one photo of your products and get a 3D shop link. Customers see them in their room at real size, ask questions, and order on WhatsApp.**

Small sellers on Instagram and WhatsApp answer the same questions all day: what size is it, will my laptop fit, can you show the back. A flat photo can't answer them, and a studio 3D model costs thousands of rupees per product. Kit turns one ordinary phone photo of several products into a shop page where every product is a real-size 3D model.

- Live: [kit-flame-beta.vercel.app](https://kit-flame-beta.vercel.app)
- Sample shop: [kit-flame-beta.vercel.app/k/sample-shop](https://kit-flame-beta.vercel.app/k/sample-shop)

## What the seller gets

1. **One photo in.** Lay products out and take one picture.
2. **Every product in 3D.** Each one is found, cut out and rebuilt as a textured 3D model.
3. **Details filled in.** A name, a short description and an estimated real size per product, for the seller to check. An optional price check searches Indian shops and shows a range with its sources.
4. **One link out** (`/k/your-shop`) for the bio, WhatsApp status and customer groups.
5. **A Shop Manager.** A morning report from the shop's own numbers and customer questions, with suggested changes that apply only after the seller taps Approve.
6. **A Reel** of the same products, to post.

## What the customer sees

- Each product in 3D, to turn and zoom.
- **See it in your room** at real size, through the phone camera (iPhone Quick Look, Android Scene Viewer, WebXR), with no app.
- **Ask about this product.** Answers come from the seller's own measurements and descriptions, with fit arithmetic ("about 32 cm vs 24 cm"), and say so when they can't know.
- **Order on WhatsApp** with the product and price already written.

## Meta models, and what each one does

| Model | Where it runs | What it does in Kit |
|---|---|---|
| Muse Spark Open | Meta open weights, on Baseten | Lists every item in the photo |
| SAM 3.1 | Meta Model API | Cuts out each listed item (box prompts, many objects per call) |
| SAM 3D Objects | Meta open weights, served via fal | Rebuilds each cut-out as a textured 3D model |
| Muse Spark | Meta Model API | Names, describes and sizes each product; price check with web search grounding and cited sources |
| Muse Wonder | Meta Model API | The shop assistant customers ask, and the Shop Manager agent that writes reports and proposes changes |
| Muse Image | Meta Model API | One empty backdrop per shop; product photos composite the real cut-out on it, so the product is never redrawn |

See [`docs/architecture.md`](docs/architecture.md) for the pipeline, data model and cost controls.

## Honest limits

- One photo shows one side of each product. The back of every 3D model is the model's best guess, so the page always calls it a 3D preview and keeps the real photo alongside.
- 3D models have no built-in real-world scale. AR size and fit answers use only the size the seller confirms.
- Cloth, thin straps, glass and shiny metal reconstruct less well than solid products.
- Price ranges come from live web search and change between searches; they appear only with at least two sources, and the seller always sets the price.

## Tech

Next.js (App Router, TypeScript strict) · react-three-fiber · `<model-viewer>` · gltf-transform · sharp · Supabase (Postgres, Storage, Realtime) · Vercel.

## Getting started

```bash
cp .env.example .env.local   # fill in keys
pnpm install
pnpm dev
```

## License

MIT
