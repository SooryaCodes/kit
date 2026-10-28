"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Exporter, type ExportFn } from "@/components/reel/exporter";
import { ReelScene, layoutItems } from "@/components/reel/reel-scene";
import { DURATION_S, SWATCHES, settingsFor, type LabelMode, type ReelFormat, type ReelSettings } from "@/components/reel/reel-settings";
import type { JobView } from "@/lib/jobs/view";
import { supabaseBrowser } from "@/lib/supabase/client";
import { TEMPLATE_LIST, TEMPLATES, isTemplateId, type AnimationPreset } from "@/lib/templates";

/** Preview clock: loops the Reel, paused while exporting (the exporter steps time itself). */
function Clock({ timeRef, paused }: { timeRef: React.RefObject<number>; paused: React.RefObject<boolean> }) {
  useFrame((_, dt) => {
    if (paused.current) return;
    timeRef.current = ((timeRef.current ?? 0) + dt) % (DURATION_S + 0.8);
  });
  return null;
}

type Phase = { kind: "edit" } | { kind: "render"; progress: number } | { kind: "upload" } | { kind: "done"; videoUrl: string; shareUrl: string | null; error?: string } | { kind: "error"; message: string };

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-full bg-paper-deep p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-full px-3 py-2 text-[14px] font-medium transition-colors ${value === o.value ? "bg-card text-ink shadow-[0_1px_2px_rgb(40_30_20/.12)]" : "text-ink-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] font-semibold text-ink-soft">{title}</h2>
      {children}
    </section>
  );
}

export function StudioEditor({ job }: { job: JobView }) {
  const [settings, setSettings] = useState<ReelSettings>(() => settingsFor(isTemplateId(job.template.id) ? job.template.id : "bag"));
  const [phase, setPhase] = useState<Phase>({ kind: "edit" });
  const timeRef = useRef(0);
  const paused = useRef(false);
  const exportRef = useRef<ExportFn | null>(null);
  const [exportDpr, setExportDpr] = useState<number | null>(null);
  const set = (patch: Partial<ReelSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const photo = job.photo ?? { width: 1536, height: 1296 };
  const entries = useMemo(() => layoutItems(job.items, photo, settings), [job.items, photo, settings]);
  const portrait = settings.format === "9:16";
  const busy = phase.kind === "render" || phase.kind === "upload";

  async function exportReel() {
    if (!exportRef.current) return;
    paused.current = true;
    setPhase({ kind: "render", progress: 0 });
    let videoUrl = "";
    try {
      const { mp4, cover } = await exportRef.current((p) => setPhase({ kind: "render", progress: p }));
      videoUrl = URL.createObjectURL(mp4);
      setPhase({ kind: "upload" });
      const res = await fetch(`/api/jobs/${job.id}/reels`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: settings.title, preset: settings.animation, settings }),
      });
      const slot = (await res.json()) as { reelId?: string; slug?: string; mp4?: { path: string; token: string }; cover?: { path: string; token: string }; error?: string };
      if (!res.ok || !slot.reelId || !slot.mp4 || !slot.cover) throw new Error(slot.error ?? "upload failed");
      const db = supabaseBrowser();
      const [a, b] = await Promise.all([
        db.storage.from("reels").uploadToSignedUrl(slot.mp4.path, slot.mp4.token, mp4, { contentType: "video/mp4" }),
        db.storage.from("covers").uploadToSignedUrl(slot.cover.path, slot.cover.token, cover, { contentType: "image/jpeg" }),
      ]);
      if (a.error || b.error) throw new Error(a.error?.message ?? b.error?.message);
      const done = await fetch(`/api/reels/${slot.reelId}/complete`, { method: "POST" });
      if (!done.ok) throw new Error("upload did not complete");
      setPhase({ kind: "done", videoUrl, shareUrl: `${window.location.origin}/s/${slot.slug}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      // the video is still in the browser: offer it even if saving the share link failed
      setPhase(videoUrl ? { kind: "done", videoUrl, shareUrl: null, error: "Saved to this device only. The share link couldn't be created." } : { kind: "error", message });
    } finally {
      paused.current = false;
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-[1320px] gap-6 px-5 pb-16 pt-2 sm:px-8 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex w-full items-center justify-center rounded-3xl bg-paper-deep/60 py-8">
          <div className="overflow-hidden rounded-2xl shadow-[0_30px_60px_-30px_rgb(40_30_20/.45)]" style={{ width: portrait ? "min(405px, 82vw)" : "min(560px, 82vw)", aspectRatio: portrait ? "9 / 16" : "1 / 1" }}>
            <Canvas gl={{ preserveDrawingBuffer: true, antialias: true }} dpr={exportDpr ?? [1, 2]}>
              <Clock timeRef={timeRef} paused={paused} />
              <ReelScene entries={entries} settings={settings} timeRef={timeRef} />
              <Exporter timeRef={timeRef} exportRef={exportRef} outputWidth={1080} setOutputDpr={setExportDpr} />
            </Canvas>
          </div>
          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl bg-paper/85">
              <p className="font-display text-[34px] leading-none text-ink">{phase.kind === "render" ? "Rendering your Reel" : "Saving your Reel"}</p>
              <div className="h-1.5 w-56 overflow-hidden rounded-full bg-paper-deep">
                <div className="h-full rounded-full bg-cobalt-500 transition-[width] duration-300" style={{ width: `${phase.kind === "render" ? Math.round(phase.progress * 100) : 100}%` }} />
              </div>
              <p className="text-[14px] text-ink-muted">{phase.kind === "render" ? `${Math.round(phase.progress * 100)}% · 1080 × ${portrait ? 1920 : 1080}, 30 fps` : "Uploading the MP4"}</p>
            </div>
          )}
        </div>
        <p className="text-[14px] text-ink-faint">
          {entries.length} items · {DURATION_S} s · {portrait ? "1080 × 1920" : "1080 × 1080"} MP4
        </p>
      </div>

      <aside className="flex flex-col gap-7 rounded-3xl bg-card p-6 lg:sticky lg:top-6 lg:max-h-[calc(100svh-120px)] lg:self-start lg:overflow-y-auto">
        {phase.kind === "done" ? (
          <div className="flex flex-col gap-5">
            <h2 className="font-display text-[44px] leading-[0.95] text-ink">
              Your Reel <span className="italic">is ready</span>
            </h2>
            <video src={phase.videoUrl} controls autoPlay loop muted playsInline className="w-full rounded-2xl bg-paper-deep" />
            {phase.error && <p className="text-[14px] text-ink-muted">{phase.error}</p>}
            <a href={phase.videoUrl} download={`${settings.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "kit-reel"}.mp4`} className="rounded-full bg-cobalt-500 px-6 py-3.5 text-center text-[16px] font-medium text-white transition-colors hover:bg-cobalt-600">
              Download MP4
            </a>
            {phase.shareUrl && (
              <>
                <button type="button" onClick={() => navigator.clipboard.writeText(phase.shareUrl!)} className="rounded-full bg-ink px-6 py-3.5 text-[16px] font-medium text-white">
                  Copy share link
                </button>
                <Link href={phase.shareUrl.replace(window.location.origin, "")} className="text-center text-[15px] font-medium text-cobalt-600 hover:underline">
                  Open the share page
                </Link>
              </>
            )}
            <button type="button" onClick={() => setPhase({ kind: "edit" })} className="text-[15px] font-medium text-ink-muted hover:text-ink">
              Keep editing
            </button>
          </div>
        ) : (
          <>
            <Field title="Format">
              <Segmented<ReelFormat> label="Format" value={settings.format} onChange={(format) => set({ format })} options={[{ value: "9:16", label: "Reel 9:16" }, { value: "1:1", label: "Post 1:1" }]} />
            </Field>

            <Field title="Template">
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_LIST.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...settingsFor(t.id), format: s.format, hidden: s.hidden, names: s.names }))}
                    className={`rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors ${settings.template === t.id ? "bg-cobalt-50 text-cobalt-700 shadow-[inset_0_0_0_1.5px_var(--color-cobalt-500)]" : "bg-paper text-ink-soft hover:bg-paper-deep"}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </Field>

            <Field title="Title">
              <input
                value={settings.title}
                onChange={(e) => set({ title: e.target.value.slice(0, 60) })}
                className="rounded-2xl bg-paper px-4 py-3 font-display text-[24px] text-ink outline-none focus:ring-2 focus:ring-cobalt-500"
                aria-label="Reel title"
              />
            </Field>

            <Field title="Background">
              <div className="flex flex-wrap items-center gap-2">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Background ${c}`}
                    onClick={() => set({ background: c })}
                    className={`size-9 rounded-full transition-transform hover:scale-110 ${settings.background === c ? "ring-2 ring-cobalt-500 ring-offset-2 ring-offset-card" : "shadow-[inset_0_0_0_1px_rgb(22_21_20/.12)]"}`}
                    style={{ background: c }}
                  />
                ))}
                <label className="relative size-9 cursor-pointer overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgb(22_21_20/.12)]" title="Your own colour">
                  <span className="absolute inset-0 flex items-center justify-center text-[18px] text-ink-muted">+</span>
                  <input type="color" value={settings.background} onChange={(e) => set({ background: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom background colour" />
                </label>
              </div>
            </Field>

            <Field title="Animation">
              <Segmented<AnimationPreset>
                label="Animation"
                value={settings.animation}
                onChange={(animation) => {
                  timeRef.current = 0;
                  set({ animation });
                }}
                options={[
                  { value: "fly-in", label: "Fly in" },
                  { value: "orbit", label: "Orbit" },
                  { value: "knolling", label: "Knolling" },
                ]}
              />
            </Field>

            <Field title="Labels">
              <Segmented<LabelMode>
                label="Labels"
                value={settings.labels}
                onChange={(labels) => set({ labels })}
                options={[
                  { value: "off", label: "Off" },
                  { value: "name", label: "Name" },
                  { value: "name-brand", label: "+ Brand" },
                  { value: "name-price", label: "+ Price" },
                ]}
              />
            </Field>

            <Field title={`Items · ${entries.length} shown`}>
              <ul className="flex flex-col gap-1">
                {job.items
                  .filter((i) => i.glbUrl)
                  .map((item) => {
                    const shown = !settings.hidden.includes(item.idx);
                    return (
                      <li key={item.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-paper">
                        <button
                          type="button"
                          aria-pressed={shown}
                          aria-label={shown ? "Hide item" : "Show item"}
                          onClick={() => set({ hidden: shown ? [...settings.hidden, item.idx] : settings.hidden.filter((h) => h !== item.idx) })}
                          className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${shown ? "bg-cobalt-500 text-white" : "bg-paper-deep text-transparent"}`}
                        >
                          ✓
                        </button>
                        {item.cropUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.cropUrl} alt="" className="size-8 shrink-0 object-contain" />
                        )}
                        <input
                          value={settings.names[item.idx] ?? item.name}
                          onChange={(e) => set({ names: { ...settings.names, [item.idx]: e.target.value.slice(0, 40) } })}
                          aria-label="Label"
                          className={`min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-1 text-[15px] outline-none focus:bg-paper ${shown ? "text-ink" : "text-ink-faint"}`}
                        />
                      </li>
                    );
                  })}
              </ul>
            </Field>

            {phase.kind === "error" && (
              <p role="alert" className="text-[14px] font-medium text-destructive">
                {phase.message}
              </p>
            )}
            <button
              type="button"
              onClick={exportReel}
              disabled={busy || entries.length === 0}
              className="sticky bottom-0 rounded-full bg-cobalt-500 px-6 py-4 text-[17px] font-medium text-white transition-[transform,background-color] hover:bg-cobalt-600 active:scale-[0.98] disabled:opacity-60"
            >
              Export Reel
            </button>
            <p className="-mt-4 text-center text-[13px] text-ink-faint">Renders in your browser. {TEMPLATES[settings.template].name} template.</p>
          </>
        )}
      </aside>
    </div>
  );
}
