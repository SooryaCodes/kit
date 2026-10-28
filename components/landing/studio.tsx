"use client";

// "Make it yours": a small working copy of the studio. Pick a colour, type a title, change the animation,
// labels or format, and the real 3D items in the preview react at once.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { cut } from "./data";
import { useInView, useLive3D } from "./hooks";
import { Reveal } from "./reveal";
import type { StudioAnimation, StudioSettings } from "./studio-scene";

const StudioScene = dynamic(() => import("./studio-scene"), { ssr: false });

const SWATCHES = [
  { name: "Cobalt", ground: "#2b44ff", ink: "#ffffff" },
  { name: "Midnight", ground: "#0e1660", ink: "#eef0ff" },
  { name: "Mist", ground: "#dfe3ff", ink: "#0e1660" },
  { name: "Paper", ground: "#e7e4de", ink: "#161514" },
  { name: "Ink", ground: "#161514", ink: "#f4f2ee" },
];

const ANIMATIONS: { id: StudioAnimation; label: string }[] = [
  { id: "fly-in", label: "Fly in" },
  { id: "orbit", label: "Orbit" },
  { id: "knolling", label: "Knolling" },
];

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-3 text-[14px] font-medium text-ink-muted">{label}</p>
      {children}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-full bg-ink/[0.06] p-1">
      {options.map((o) => (
        <button
          key={o.id}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`h-10 rounded-full px-4 text-[15px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-cobalt-500 ${value === o.id ? "bg-card text-ink shadow-[0_1px_2px_rgb(22_21_20/0.12)]" : "text-ink-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Studio() {
  const live = useLive3D();
  const stageRef = useRef<HTMLDivElement>(null);
  const { near, visible } = useInView(stageRef, "80% 0px");
  const [swatch, setSwatch] = useState(0);
  const [title, setTitle] = useState("What’s in my bag");
  const [animation, setAnimation] = useState<StudioAnimation>("fly-in");
  const [labels, setLabels] = useState(true);
  const [square, setSquare] = useState(false);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const sw = SWATCHES[swatch]!;
  const settings: StudioSettings = { ground: sw.ground, ink: sw.ink, animation, labels, square };

  const colour = (
    <Group label="Colour">
      <div className="flex gap-2.5">
        {SWATCHES.map((s, i) => (
          <button
            key={s.name}
            onClick={() => setSwatch(i)}
            aria-label={s.name}
            aria-pressed={swatch === i}
            className={`kit-press size-10 rounded-full ring-offset-2 ring-offset-paper transition-shadow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cobalt-500 ${swatch === i ? "ring-2 ring-ink" : "ring-1 ring-ink/10"}`}
            style={{ background: s.ground }}
          />
        ))}
      </div>
    </Group>
  );

  const titleField = (
    <Group label="Title">
      <input
        value={title}
        maxLength={26}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Reel title"
        className="font-display h-12 w-full max-w-[17rem] rounded-full bg-ink/[0.06] px-5 text-[22px] outline-none transition-shadow focus:ring-2 focus:ring-cobalt-500"
      />
    </Group>
  );

  const motion = (
    <Group label="Animation">
      <Segmented value={animation} options={ANIMATIONS} onChange={setAnimation} />
    </Group>
  );

  const extras = (
    <div className="flex flex-wrap gap-x-6 gap-y-6 lg:flex-col">
      <Group label="Labels">
        <Segmented
          value={labels ? "on" : "off"}
          options={[
            { id: "on", label: "On" },
            { id: "off", label: "Off" },
          ]}
          onChange={(v) => setLabels(v === "on")}
        />
      </Group>
      <Group label="Format">
        <Segmented
          value={square ? "1:1" : "9:16"}
          options={[
            { id: "9:16", label: "9:16" },
            { id: "1:1", label: "1:1" },
          ]}
          onChange={(v) => setSquare(v === "1:1")}
        />
      </Group>
    </div>
  );

  return (
    <Reveal as="section" className="relative bg-paper-deep/60 py-28 md:py-40" aria-label="Studio">
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <div className="text-center">
          <h2 data-r style={{ ["--i" as string]: 0 }} className="font-display text-[clamp(34px,5.6vw,88px)] leading-[0.92] tracking-[-0.02em]">
            Plus a Reel <span className="italic">to post.</span>
          </h2>
          <p data-r style={{ ["--i" as string]: 1 }} className="mx-auto mt-6 max-w-[32rem] text-[17px] leading-[1.5] text-ink-soft md:text-[19px]">
            The same 3D products become a Reel that sends people to your link. Try the studio here on three things from the sample bag.
          </p>
        </div>

        <div data-r style={{ ["--i" as string]: 2 }} className="mt-14 grid items-center gap-10 md:mt-20 lg:grid-cols-[1fr_auto_1fr] lg:gap-14">
          <div className="order-2 flex flex-col items-center gap-8 lg:order-1 lg:items-end lg:text-right">
            {colour}
            {titleField}
          </div>

          <div className="order-1 flex justify-center lg:order-2">
            <div ref={stageRef} className="relative h-[520px] md:h-[600px]" style={{ width: square ? "min(600px, calc(100vw - 40px))" : "min(338px, calc(100vw - 40px))", transition: "width 0.5s var(--ease-expo)" }}>
              <div className="absolute inset-0 overflow-hidden rounded-[26px] transition-colors duration-300" style={{ background: sw.ground }}>
                <p className="font-display absolute inset-x-0 top-[7%] z-10 px-6 text-center text-[34px] leading-[0.95] transition-colors duration-300 md:text-[40px]" style={{ color: sw.ink }}>
                  {title || " "}
                </p>
                {/* still picture until the live scene is ready, and for reduced motion */}
                <div className="absolute inset-x-0 bottom-[14%] flex items-end justify-center gap-4 transition-opacity duration-500" style={{ opacity: live && ready ? 0 : 1 }} aria-hidden>
                  {[6, 0, 12].map((id) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={id} src={cut("bag", id)} alt="" className="shadow-object w-auto" style={{ height: id === 0 ? 170 : 90 }} />
                  ))}
                </div>
                {live && near && (
                  <div className="absolute inset-0 transition-opacity duration-500" style={{ opacity: ready ? 1 : 0 }}>
                    <StudioScene settings={settings} active={visible} onReady={onReady} />
                  </div>
                )}
                <p className="absolute inset-x-0 bottom-5 z-10 text-center text-[13px] transition-colors duration-300" style={{ color: sw.ink, opacity: 0.7 }}>
                  Made with Kit
                </p>
              </div>
            </div>
          </div>

          <div className="order-3 flex flex-col items-center gap-8 lg:items-start">
            {motion}
            {extras}
          </div>
        </div>

        <div className="mt-14 flex justify-center md:mt-16">
          <Link
            href="/new?template=bag"
            className="kit-press inline-flex h-14 items-center rounded-full bg-cobalt-500 px-8 text-[17px] font-medium text-white hover:bg-cobalt-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cobalt-500"
          >
            Make your Reel
          </Link>
        </div>
      </div>
    </Reveal>
  );
}
