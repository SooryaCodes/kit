# Kit

**Photograph your stuff. Get a 3D Reel.**

Kit turns one phone photo of your things into an animated 3D showcase: what's in your bag, your desk setup, your outfit, your collection, or a seller's products. Every item is detected, cut out, rebuilt as a textured 3D model, identified and labelled, then animated and exported as a vertical video in under a minute.

> Status: in active development.

## How it works

```
photo
 → item listing        (Muse Spark)
 → segmentation        (SAM 3.1)
 → per-item 3D models  (SAM 3D Objects)
 → identification      (Muse Spark)
 → themed scene + cover (Muse Image)
 → animated 3D scene   (three.js)
 → 1080×1920 MP4 Reel
```

See [`docs/architecture.md`](docs/architecture.md) for details.

## Tech

- Next.js (App Router, TypeScript) · react-three-fiber
- Meta Model API (Muse Spark, SAM 3.1, Muse Image) · Meta open-weight models
- Supabase (Postgres, Storage, Realtime) · Vercel

## Getting started

```bash
cp .env.example .env.local   # fill in keys
pnpm install
pnpm dev
```

## License

MIT
