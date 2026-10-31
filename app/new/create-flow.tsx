"use client";

// The first step: one photo of the products. A large drop zone (camera on phones), what makes a good photo,
// whether the page sells or recommends, and two sample photos that replay a finished run for free.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveReel } from "@/lib/client/my-reels";
import type { TemplateId } from "@/lib/templates";

type Mode = "shop" | "creator";

/** Sample photos that already have a finished run, so trying one replays it for free. */
const SAMPLES = [
  { id: "shop", url: "/showcase/shop/photo.jpg", template: "seller" as TemplateId, file: "sample-shop.jpg", title: "A leather goods shelf", note: "12 slings, front view" },
  { id: "bag", url: "/showcase/bag/photo.jpg", template: "bag" as TemplateId, file: "sample-bag.jpg", title: "What's in a bag", note: "14 things, flat lay" },
];

const TIPS = [
  { title: "Lay them out", text: "On a bed, table or floor with a plain cover. Flat from above, or standing in a row from the front." },
  { title: "Leave a little space", text: "A finger's width between products, so each one is cut out cleanly." },
  { title: "Use daylight", text: "Near a window, no flash. Solid products come out best; glass and thin straps are harder." },
];

export function CreateFlow({ initialTemplate }: { initialTemplate: TemplateId }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialTemplate === "seller" || initialTemplate === "collection" ? "shop" : "creator");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
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

  async function start(photo: File, template: TemplateId, label: string) {
    setBusy(label);
    setError(null);
    try {
      const body = new FormData();
      body.set("photo", photo);
      body.set("template", template);
      const res = await fetch("/api/jobs", { method: "POST", body });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "We couldn't read this photo. Please try again.");
      saveReel({ id: data.id, template, createdAt: new Date().toISOString() });
      router.push(`/studio/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(null);
    }
  }

  async function trySample(s: (typeof SAMPLES)[number]) {
    setBusy(s.id);
    const blob = await fetch(s.url).then((r) => r.blob());
    await start(new File([blob], s.file, { type: "image/jpeg" }), s.template, s.id);
  }

  const template: TemplateId = mode === "shop" ? "seller" : "bag";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
      <section className="flex flex-col gap-6" aria-labelledby="photo-h">
        <div className="text-center lg:text-left">
          <h1 id="photo-h" className="font-display text-[clamp(44px,5.2vw,76px)] leading-[0.92] tracking-[-0.02em] text-ink">
            One photo of <span className="italic">your products.</span>
          </h1>
          <p className="mt-4 max-w-[34rem] text-[17px] leading-[1.5] text-ink-soft max-lg:mx-auto md:text-[19px]">
            Kit finds every product in it, cuts each one out and rebuilds it in 3D. About a minute.
          </p>
        </div>

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
          className={`relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-3xl p-6 transition-colors duration-300 ${dragging ? "bg-cobalt-50 ring-2 ring-cobalt-500" : "bg-card ring-1 ring-paper-shade"}`}
        >
          {preview ? (
            <div className="flex w-full flex-col items-center gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Your photo" className="max-h-[52vh] w-auto rounded-2xl object-contain" />
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => file && start(file, template, "upload")}
                  disabled={busy !== null}
                  className="kit-press rounded-full bg-cobalt-500 px-7 py-4 text-[17px] font-medium text-white hover:bg-cobalt-600 disabled:opacity-60"
                >
                  {busy === "upload" ? "Uploading…" : "Find my products"}
                </button>
                <button type="button" onClick={() => setFile(null)} disabled={busy !== null} className="rounded-full px-6 py-4 text-[17px] font-medium text-ink-muted hover:text-ink">
                  Choose another
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="font-display text-[clamp(30px,2.6vw,40px)] leading-tight text-ink">
                <span className="sm:hidden">Add your photo</span>
                <span className="hidden sm:inline">Drop your photo here</span>
              </p>
              <p className="max-w-sm text-[16px] text-ink-muted">All your products in one shot. JPEG or PNG, up to 15 MB.</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => cameraRef.current?.click()} className="kit-press rounded-full bg-cobalt-500 px-7 py-4 text-[17px] font-medium text-white hover:bg-cobalt-600 lg:hidden">
                  Take a photo
                </button>
                <button
                  type="button"
                  onClick={() => pickRef.current?.click()}
                  className="kit-press rounded-full bg-ink px-7 py-4 text-[17px] font-medium text-white hover:bg-ink-soft lg:bg-cobalt-500 lg:hover:bg-cobalt-600"
                >
                  Choose a photo
                </button>
              </div>
            </div>
          )}
          <input ref={pickRef} type="file" accept="image/*" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
        </div>

        {error && (
          <p role="alert" className="text-center text-[15px] font-medium text-destructive">
            {error}
          </p>
        )}
      </section>

      <aside className="flex flex-col gap-8 lg:pt-4">
        <section aria-labelledby="mode-h" className="flex flex-col gap-3">
          <h2 id="mode-h" className="text-[16px] font-semibold text-ink">
            These products are
          </h2>
          <div className="flex gap-1 rounded-full bg-paper-deep p-1" role="radiogroup" aria-label="Page type">
            {(["shop", "creator"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-full px-3 py-2.5 text-[15px] font-medium transition-colors ${mode === m ? "bg-card text-ink" : "text-ink-muted hover:text-ink"}`}
              >
                {m === "shop" ? "For sale" : "Things I recommend"}
              </button>
            ))}
          </div>
          <p className="text-[14px] text-ink-muted">{mode === "shop" ? "Customers order on WhatsApp." : "Followers buy through your own links."}</p>
        </section>

        <section aria-labelledby="tips-h" className="flex flex-col gap-4">
          <h2 id="tips-h" className="text-[16px] font-semibold text-ink">
            For the best 3D
          </h2>
          <ul className="flex flex-col gap-4">
            {TIPS.map((t) => (
              <li key={t.title}>
                <p className="text-[15px] font-medium text-ink">{t.title}</p>
                <p className="text-[14px] leading-[1.5] text-ink-soft">{t.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="sample-h" className="flex flex-col gap-3">
          <h2 id="sample-h" className="text-[16px] font-semibold text-ink">
            No photo yet? Try one of ours
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {SAMPLES.map((s) => (
              <button key={s.id} type="button" onClick={() => trySample(s)} disabled={busy !== null} className="group flex flex-col gap-2 text-left disabled:opacity-60">
                <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-paper-deep">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                  {busy === s.id && <span className="absolute inset-0 flex items-center justify-center bg-ink/40 text-[14px] font-medium text-white">Opening…</span>}
                </span>
                <span className="text-[14px] font-medium leading-tight text-ink">{s.title}</span>
                <span className="-mt-1.5 text-[13px] text-ink-muted">{s.note}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
