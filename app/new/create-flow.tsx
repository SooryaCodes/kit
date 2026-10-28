"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveReel } from "@/lib/client/my-reels";
import { TEMPLATE_LIST, type TemplateId } from "@/lib/templates";

/** Sample photos that already have a finished run, so trying one replays it for free. */
const SAMPLES = {
  shop: { url: "/showcase/shop/photo.jpg", template: "seller" as TemplateId, label: "Try our sample shop photo", file: "sample-shop.jpg" },
  bag: { url: "/showcase/bag/photo.jpg", template: "bag" as TemplateId, label: "Try our sample bag", file: "sample-bag.jpg" },
};

/** A real object from each kind of shoot, so every format reads at a glance. */
const TILE_ART: Record<TemplateId, { src: string; w: string; r: number }[]> = {
  bag: [
    { src: "/showcase/bag/0.png", w: "46%", r: -6 },
    { src: "/showcase/bag/3.png", w: "16%", r: 12 },
  ],
  desk: [
    { src: "/showcase/desk/1.png", w: "56%", r: -4 },
    { src: "/showcase/desk/6.png", w: "18%", r: 10 },
  ],
  fit: [
    { src: "/showcase/outfit/3.png", w: "44%", r: -8 },
    { src: "/showcase/outfit/1.png", w: "30%", r: 14 },
  ],
  collection: [
    { src: "/showcase/sneakers/0.png", w: "40%", r: -10 },
    { src: "/showcase/sneakers/10.png", w: "36%", r: 8 },
  ],
  seller: [
    { src: "/showcase/products/3.png", w: "40%", r: -6 },
    { src: "/showcase/products/9.png", w: "30%", r: 10 },
  ],
};

export function CreateFlow({ initialTemplate }: { initialTemplate: TemplateId }) {
  const router = useRouter();
  const [template, setTemplate] = useState<TemplateId>(initialTemplate);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const choose = useCallback((f: File | undefined | null) => {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("That file isn't a photo.");
    if (f.size > 15 * 1024 * 1024) return setError("That photo is over 15 MB. Try a smaller one.");
    setFile(f);
  }, []);

  async function start(photo: File, tpl: TemplateId) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("photo", photo);
      body.set("template", tpl);
      const res = await fetch("/api/jobs", { method: "POST", body });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "We couldn't start this Reel. Please try again.");
      saveReel({ id: data.id, template: tpl, createdAt: new Date().toISOString() });
      router.push(`/j/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const sample = template === "seller" || template === "collection" ? SAMPLES.shop : SAMPLES.bag;
  async function trySample() {
    setBusy(true);
    const blob = await fetch(sample.url).then((r) => r.blob());
    setTemplate(sample.template);
    await start(new File([blob], sample.file, { type: "image/jpeg" }), sample.template);
  }

  const current = TEMPLATE_LIST.find((t) => t.id === template)!;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 pb-28 pt-6 text-center sm:px-8 sm:pt-10">
      <h1 className="font-display text-title text-ink">
        What are we <span className="italic">shooting?</span>
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-lead text-ink-muted">Pick a format and add one photo. Kit finds every item and builds each one in 3D.</p>

      <fieldset className="mt-12" disabled={busy}>
        <legend className="sr-only">Format</legend>
        <div className="flex snap-x gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:overflow-visible">
          {TEMPLATE_LIST.map((t) => {
            const on = t.id === template;
            return (
              <label
                key={t.id}
                className={`group relative flex w-[42vw] shrink-0 snap-center cursor-pointer flex-col rounded-2xl p-2 text-left transition-[background-color,box-shadow,transform] duration-300 sm:w-auto ${
                  on ? "bg-card shadow-[0_0_0_2px_var(--color-cobalt-500)]" : "bg-card/60 hover:-translate-y-0.5 hover:bg-card"
                }`}
              >
                <input type="radio" name="template" value={t.id} checked={on} onChange={() => setTemplate(t.id)} className="sr-only" />
                <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-paper-deep/70">
                  {TILE_ART[t.id].map((a, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={a.src}
                      src={a.src}
                      alt=""
                      className="shadow-object absolute top-1/2 transition-transform duration-500 group-hover:scale-[1.04]"
                      style={{ width: a.w, left: i === 0 ? "14%" : "62%", transform: `translateY(-50%) rotate(${a.r}deg)` }}
                    />
                  ))}
                </span>
                <span className="px-2 pb-1.5 pt-3 text-[15px] font-medium text-ink">{t.name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          choose(e.dataTransfer.files[0]);
        }}
        className={`mx-auto mt-6 max-w-[760px] rounded-3xl p-6 transition-colors duration-300 sm:p-10 ${dragging ? "bg-cobalt-50 shadow-[0_0_0_2px_var(--color-cobalt-500)]" : "bg-card"}`}
      >
        {preview ? (
          <div className="flex flex-col items-center gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your photo" className="max-h-[44vh] w-auto rounded-2xl object-contain" />
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => file && start(file, template)}
                disabled={busy}
                className="rounded-full bg-cobalt-500 px-7 py-4 text-[17px] font-medium text-white transition-[transform,background-color] hover:bg-cobalt-600 active:scale-[0.97] disabled:opacity-60"
              >
                {busy ? "Uploading…" : "Find my items"}
              </button>
              <button type="button" onClick={() => setFile(null)} disabled={busy} className="rounded-full px-6 py-4 text-[17px] font-medium text-ink-muted transition-colors hover:text-ink">
                Choose another
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="font-display text-[clamp(28px,2.4vw,40px)] leading-tight text-ink">
              Drop your <span className="italic">{current.name.toLowerCase()}</span> photo
            </p>
            <p className="max-w-md text-[16px] text-ink-muted">{current.prompt} Good light, a plain surface and a little space between things work best.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => pickRef.current?.click()}
                className="rounded-full bg-cobalt-500 px-7 py-4 text-[17px] font-medium text-white transition-[transform,background-color] hover:bg-cobalt-600 active:scale-[0.97]"
              >
                Choose a photo
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="rounded-full bg-ink px-6 py-4 text-[17px] font-medium text-white transition-transform active:scale-[0.97] sm:hidden"
              >
                Take a photo
              </button>
            </div>
          </div>
        )}
        <input ref={pickRef} type="file" accept="image/*" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
      </div>

      {error && (
        <p role="alert" className="mt-4 text-[15px] font-medium text-destructive">
          {error}
        </p>
      )}

      <p className="mt-8 text-[16px] text-ink-muted">
        No photo handy?{" "}
        <button type="button" onClick={trySample} disabled={busy} className="font-medium text-cobalt-600 underline-offset-4 hover:underline">
          {sample.label}
        </button>
      </p>
    </div>
  );
}
