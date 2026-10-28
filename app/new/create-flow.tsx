"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveReel } from "@/lib/client/my-reels";
import { TEMPLATE_LIST, type TemplateId } from "@/lib/templates";

const SAMPLE = { url: "/showcase/bag/photo.jpg", template: "bag" as TemplateId };

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

  async function trySample() {
    setBusy(true);
    const blob = await fetch(SAMPLE.url).then((r) => r.blob());
    setTemplate(SAMPLE.template);
    await start(new File([blob], "sample-bag.jpg", { type: "image/jpeg" }), SAMPLE.template);
  }

  const current = TEMPLATE_LIST.find((t) => t.id === template)!;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-10 text-center sm:px-6 sm:pt-16">
      <h1 className="font-display text-[clamp(2.25rem,1.4rem+4vw,4.5rem)] leading-[0.92] text-ink">
        What are we
        <br />
        shooting?
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-lead text-ink-muted">Pick a format, add one photo. Kit finds every item and builds each one in 3D.</p>

      <fieldset className="mt-10" disabled={busy}>
        <legend className="sr-only">Format</legend>
        <div className="flex flex-col gap-1.5">
          {TEMPLATE_LIST.map((t) => {
            const on = t.id === template;
            return (
              <label
                key={t.id}
                className={`group flex cursor-pointer items-center justify-between gap-4 rounded-lg px-5 py-4 text-left transition-colors ${
                  on ? "bg-red-500 text-white" : "bg-white/70 text-ink hover:bg-red-100"
                }`}
              >
                <input type="radio" name="template" value={t.id} checked={on} onChange={() => setTemplate(t.id)} className="sr-only" />
                <span className="font-display text-[clamp(1.05rem,0.9rem+0.8vw,1.5rem)] leading-none">{t.name}</span>
                <span className={`hidden max-w-[22rem] text-[15px] leading-snug sm:block ${on ? "text-white/85" : "text-ink-muted"}`}>{t.prompt}</span>
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
        className={`mt-6 rounded-xl p-6 transition-colors sm:p-8 ${dragging ? "bg-red-200" : "bg-red-100"}`}
      >
        {preview ? (
          <div className="flex flex-col items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your photo" className="max-h-[46vh] w-auto rounded-lg object-contain" />
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => file && start(file, template)}
                disabled={busy}
                className="rounded-md bg-red-500 px-6 py-3.5 text-[17px] font-medium text-white transition-transform active:scale-[0.97] disabled:opacity-60"
              >
                {busy ? "Uploading…" : "Find my items"}
              </button>
              <button
                type="button"
                onClick={() => setFile(null)}
                disabled={busy}
                className="rounded-md bg-white px-5 py-3.5 text-[17px] font-medium text-ink transition-colors hover:bg-red-50"
              >
                Choose another
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-lead text-ink">Drop your photo here</p>
            <p className="max-w-md text-[15px] text-ink-muted">{current.prompt} Good light, a plain surface and a little space between things work best.</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => pickRef.current?.click()}
                className="rounded-md bg-red-500 px-6 py-3.5 text-[17px] font-medium text-white transition-transform active:scale-[0.97]"
              >
                Choose a photo
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="rounded-md bg-white px-5 py-3.5 text-[17px] font-medium text-ink transition-colors hover:bg-red-50 sm:hidden"
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
        <p role="alert" className="mt-4 text-[15px] font-medium text-red-700">
          {error}
        </p>
      )}

      <p className="mt-8 text-[15px] text-ink-muted">
        No photo handy?{" "}
        <button type="button" onClick={trySample} disabled={busy} className="font-medium text-red-600 underline-offset-4 hover:underline">
          Try our sample bag
        </button>
      </p>
    </div>
  );
}
