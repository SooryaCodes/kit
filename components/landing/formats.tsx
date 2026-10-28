"use client";

// The five templates as a fanned hand of Reel cards, each built from a real collection's cutouts.
// Click, tap, swipe or use the arrow keys to bring one to the front.

import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cut, FORMATS, type Format } from "./data";
import { useIsPhone } from "./hooks";
import { Reveal } from "./reveal";

function ReelCard({ f }: { f: Format }) {
  return (
    <div className="flex h-full flex-col rounded-[22px] px-[7%] pb-[6%] pt-[9%]" style={{ background: f.ground, color: f.ink }}>
      <p className="font-display text-center text-[24px] leading-[0.95] lg:text-[32px]">{f.name}</p>
      <div className="mt-[8%] grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-x-[6%] gap-y-[4%]">
        {f.items.slice(0, 6).map((it, i) => (
          <figure key={`${it.id}-${i}`} className="flex min-h-0 flex-col items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cut(f.set, it.id)} alt="" loading="lazy" draggable={false} className="shadow-object h-0 min-h-0 w-full flex-1 object-contain" />
            <figcaption className="mt-1.5 text-[13px] leading-none opacity-85">{it.name}</figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-[6%] flex items-center justify-center gap-2 text-[13px] opacity-75">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.photo} alt="" loading="lazy" draggable={false} className="h-5 w-7 rounded-[3px] object-cover" />
        Made with Kit
      </div>
    </div>
  );
}

export function Formats() {
  const [active, setActive] = useState(2);
  const phone = useIsPhone();
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const n = FORMATS.length;
  const go = (i: number) => setActive(Math.max(0, Math.min(n - 1, i)));
  const current = FORMATS[active]!;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") go(active - 1);
    if (e.key === "ArrowRight") go(active + 1);
  };
  const onDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, moved: false };
  };
  const onUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
  };

  return (
    <Reveal as="section" id="formats" className="relative overflow-hidden py-28 md:py-40" aria-label="Templates">
      <div className="mx-auto max-w-[1320px] px-5 text-center md:px-8">
        <h2 data-r style={{ ["--i" as string]: 0 }} className="font-display text-[clamp(34px,5.6vw,88px)] leading-[0.92] tracking-[-0.02em]">
          One photo, <span className="italic">five kinds of Reel.</span>
        </h2>
        <p data-r style={{ ["--i" as string]: 1 }} className="mx-auto mt-6 max-w-[32rem] text-[17px] leading-[1.5] text-ink-soft md:text-[19px]">
          Each template sets the title, colours and animation. These are real collections, cut out and rebuilt by Kit.
        </p>
      </div>

      <div data-r style={{ ["--i" as string]: 2 }}>
        <div
          className="relative mx-auto mt-14 h-[440px] max-w-[1320px] touch-pan-y select-none outline-none md:mt-20 lg:h-[600px]"
          role="listbox"
          aria-label="Templates"
          aria-activedescendant={`format-${current.template}`}
          tabIndex={0}
          onKeyDown={onKey}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={() => (drag.current = null)}
        >
          {FORMATS.map((f, i) => {
            const o = i - active;
            const a = Math.abs(o);
            // on a phone the outer cards tuck further in, so their labels stay on screen
            const x = o * (phone ? (a > 1 ? 36 : 38) : a > 1 ? 52 : 58);
            const r = o * (a > 1 ? 7 : 6);
            const s = 1 - Math.min(a, 2) * (phone ? 0.1 : 0.09);
            return (
              <button
                key={f.template}
                id={`format-${f.template}`}
                role="option"
                aria-selected={o === 0}
                aria-label={f.name}
                tabIndex={-1}
                onClick={() => go(i)}
                className="group absolute left-1/2 top-1/2 h-[400px] w-[225px] cursor-pointer lg:h-[560px] lg:w-[315px]"
                style={{
                  transform: `translate(-50%, -50%) translateX(${x}%) translateY(${a * 4}%) rotate(${r}deg) scale(${s})`,
                  zIndex: 10 - a,
                  // a phone shows three cards; the outer two wait off stage
                  opacity: phone && a > 1 ? 0 : 1,
                  pointerEvents: phone && a > 1 ? "none" : undefined,
                  transition: "transform 0.7s var(--ease-expo), opacity 0.4s ease",
                }}
              >
                <div
                  className="h-full w-full rounded-[22px] transition-[transform,box-shadow] duration-300 group-hover:-translate-y-2"
                  style={{ boxShadow: o === 0 ? "0 40px 60px -30px rgb(40 30 20 / 0.45), 0 8px 16px -8px rgb(40 30 20 / 0.25)" : "0 24px 40px -28px rgb(40 30 20 / 0.4)" }}
                >
                  <ReelCard f={f} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mx-auto mt-10 max-w-[30rem] px-5 text-center md:mt-14">
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => go(active - 1)}
              disabled={active === 0}
              aria-label="Previous template"
              className="kit-press grid size-11 place-items-center rounded-full bg-ink/5 text-[18px] hover:bg-ink/10 disabled:opacity-30"
            >
              ←
            </button>
            <h3 className="font-display min-w-[11ch] text-[34px] leading-none md:text-[40px]" aria-live="polite">
              {current.name}
            </h3>
            <button
              onClick={() => go(active + 1)}
              disabled={active === n - 1}
              aria-label="Next template"
              className="kit-press grid size-11 place-items-center rounded-full bg-ink/5 text-[18px] hover:bg-ink/10 disabled:opacity-30"
            >
              →
            </button>
          </div>
          <p className="mt-4 min-h-[3em] text-[17px] leading-[1.5] text-ink-soft">{current.line}</p>
          <Link href={`/new?template=${current.template}`} className="group mt-3 inline-flex items-center gap-2 text-[17px] font-medium text-cobalt-600 hover:text-cobalt-700">
            Use this template
            <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </Reveal>
  );
}
