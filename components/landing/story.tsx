"use client";

// The signature: a pinned scroll story over the real sample photo. The DOM holds the heading, the caption for
// each step and the progress; the canvas (story-scene) does the rest. Progress lives in a ref, read every frame,
// so scrolling never re-renders React except when the step changes.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BAG_PHOTO, cut } from "./data";
import { useInView, useLive3D, useWebGL } from "./hooks";

const StoryScene = dynamic(() => import("./story-scene"), { ssr: false });

// mirror of STAGES in story-scene (kept here so the DOM does not load the 3D bundle)
const BOUNDS = [0.04, 0.25, 0.43, 0.64, 1] as const;

const STEPS = [
  { model: "Muse Spark Open", title: "Muse Spark lists every item", text: "It reads the photo and names every product in it, down to the smallest." },
  { model: "SAM 3.1", title: "SAM 3.1 cuts each one out", text: "A clean mask for every product, straps and clips included." },
  { model: "SAM 3D Objects", title: "SAM 3D Objects rebuilds it in 3D", text: "Each cutout becomes a textured model customers can turn and place in their room." },
  { model: "Kit", title: "Kit makes the shop link", text: "Every product named, priced and in 3D, with Order on WhatsApp. One link for your bio." },
];

function stepFor(p: number) {
  if (p < BOUNDS[1]) return 0;
  if (p < BOUNDS[2]) return 1;
  if (p < BOUNDS[3]) return 2;
  return 3;
}

export function Story() {
  const live = useLive3D();
  const gl = useWebGL();
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const progress = useRef(0);
  const [step, setStep] = useState(0);
  const [bands, setBands] = useState({ top: 180, bottom: 200 });
  const { near, visible } = useInView(sectionRef, "150% 0px");
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const [still, setStill] = useState<{ w: number; h: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const h = headRef.current;
      const f = footRef.current;
      if (!h || !f) return;
      // both are pinned to the sticky stage's edges, so their heights are the bands
      setBands({ top: h.offsetHeight, bottom: f.offsetHeight });
      // where the scene's first frame puts the photo (same fit as the camera), for the still shown until it loads
      const W = window.innerWidth;
      const H = window.innerHeight;
      const avail = Math.max(0.3 * H, H - h.offsetHeight - f.offsetHeight);
      const ratio = BAG_PHOTO.height / BAG_PHOTO.width;
      const w = Math.min(1.22 * W, (0.9 * avail) / ratio);
      setStill({ w, h: w * ratio, top: h.offsetHeight + avail / 2 - (w * ratio) / 2 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (headRef.current) ro.observe(headRef.current);
    if (footRef.current) ro.observe(footRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [live]);

  useEffect(() => {
    if (!live) return;
    let id = 0;
    let last = -1;
    const tick = () => {
      const el = sectionRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const total = r.height - window.innerHeight;
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
        progress.current = p;
        const s = stepFor(p);
        if (s !== last) {
          last = s;
          setStep(s);
        }
        bars.current.forEach((b, i) => {
          if (!b) return;
          const k = Math.min(1, Math.max(0, (p - BOUNDS[i]!) / (BOUNDS[i + 1]! - BOUNDS[i]!)));
          b.style.transform = `scaleX(${i === 0 && p < BOUNDS[0] ? 0 : k})`;
        });
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [live]);

  if (gl !== null && !live) return <StoryStill />;

  return (
    <section ref={sectionRef} id="how" aria-label="How it works" className="relative h-[480vh] md:h-[520vh]">
      <div className="sticky top-0 h-svh overflow-hidden">
        <div ref={headRef} className="absolute inset-x-0 top-0 z-10 px-5 pt-[max(28px,5vh)] text-center">
          <h2 className="font-display text-[clamp(38px,5vw,76px)] leading-[0.92] tracking-[-0.02em]">
            One photo. <span className="italic">Every item in 3D.</span>
          </h2>
        </div>

        {still && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={BAG_PHOTO.src}
            alt=""
            aria-hidden
            className="absolute left-1/2 max-w-none -translate-x-1/2 transition-opacity duration-500"
            style={{ width: still.w, height: still.h, top: still.top, opacity: ready ? 0 : 1 }}
          />
        )}
        <div className="absolute inset-0">{near && live && <StoryScene progress={progress} bands={bands} active={visible} onReady={onReady} />}</div>

        <div ref={footRef} className="absolute inset-x-0 bottom-0 z-10 px-5 pb-[max(24px,4.5vh)]">
          <div className="relative mx-auto h-[118px] max-w-[40rem] text-center md:h-[112px]">
            {STEPS.map((s, i) => (
              <div
                key={s.model}
                className="absolute inset-x-0 bottom-0 transition-[opacity,transform,visibility] duration-500"
                style={{
                  opacity: step === i ? 1 : 0,
                  visibility: step === i ? "visible" : "hidden",
                  transform: `translateY(${step === i ? 0 : step > i ? -12 : 12}px)`,
                  transitionTimingFunction: "var(--ease-out)",
                }}
                aria-hidden={step !== i}
              >
                <p className="font-display text-[30px] leading-[1.02] md:text-[40px]">{s.title}</p>
                <p className="mx-auto mt-2 max-w-[35rem] text-[15px] leading-[1.45] text-ink-soft md:text-[17px]">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-5 flex max-w-[22rem] gap-1.5" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s.model} className="h-[3px] flex-1 overflow-hidden rounded-full bg-ink/10">
                <span
                  ref={(el) => {
                    bars.current[i] = el;
                  }}
                  className="block h-full origin-left rounded-full bg-cobalt-500"
                  style={{ transform: "scaleX(0)" }}
                />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Reduced motion or no WebGL: the same four steps, laid out still. */
function StoryStill() {
  const picks = [6, 12, 3, 2];
  return (
    <section id="how" className="relative mx-auto max-w-[1100px] px-5 py-28 text-center md:px-8 md:py-40">
      <h2 className="font-display text-[clamp(38px,5vw,76px)] leading-[0.92] tracking-[-0.02em]">
        One photo. <span className="italic">Every item in 3D.</span>
      </h2>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BAG_PHOTO.src} alt="The sample flat-lay: a backpack and thirteen things from inside it on a white sheet" className="mx-auto mt-12 w-full max-w-[720px]" />
      <div className="mt-10 flex items-end justify-center gap-6">
        {picks.map((id) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={id} src={cut("bag", id)} alt="" className="shadow-object h-20 w-auto md:h-28" />
        ))}
      </div>
      <ol className="mx-auto mt-14 grid max-w-[60rem] gap-10 text-left md:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.model}>
            <p className="font-display text-[32px] leading-none">{s.title}</p>
            <p className="mt-2 text-ink-soft">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
