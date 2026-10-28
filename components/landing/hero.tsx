"use client";

// First screen. The approved Studio hero: the headline sits on the paper, real products float around it.
// Static cutouts paint first (and stay for reduced motion or no WebGL); the live 3D scene fades in over them
// once every model has loaded, in exactly the same places.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cut, HERO_DESKTOP, HERO_MOBILE, type Placed } from "./data";
import type { StageRect } from "./hero-scene";
import { useInView, useIsPhone, useLive3D } from "./hooks";

const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false });

function Cutouts({ layout, className, hidden }: { layout: Placed[]; className: string; hidden: boolean }) {
  return (
    <div className={`${className} pointer-events-none absolute inset-0 transition-opacity duration-700`} style={{ opacity: hidden ? 0 : 1 }} aria-hidden>
      {layout.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${p.set}-${p.id}`}
          src={cut(p.set, p.id)}
          alt=""
          className="kit-settle shadow-object absolute"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, rotate: `${p.r}deg`, animationDelay: `${120 + i * 60}ms` }}
        />
      ))}
    </div>
  );
}

export function Hero() {
  const live = useLive3D();
  const phone = useIsPhone();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { visible } = useInView(sectionRef, "0px");
  const [stage, setStage] = useState<StageRect | null>(null);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    const section = sectionRef.current;
    const el = stageRef.current;
    if (!section || !el) return;
    const measure = () => {
      const s = section.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setStage({ left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(section);
    return () => ro.disconnect();
  }, []);

  const layout = phone ? HERO_MOBILE : HERO_DESKTOP;

  return (
    <section ref={sectionRef} className="relative h-[calc(100svh-80px)] min-h-[600px] md:min-h-[640px]">
      {/* the stage the cutouts are placed in */}
      <div className="absolute inset-0 mx-auto max-w-[1320px] px-4 md:px-8">
        <div ref={stageRef} className="relative h-full">
          <Cutouts layout={HERO_DESKTOP} className="hidden md:block" hidden={ready} />
          <Cutouts layout={HERO_MOBILE} className="md:hidden" hidden={ready} />
        </div>
      </div>

      {live && stage && (
        <div className="pointer-events-none absolute inset-0 transition-opacity duration-700" style={{ opacity: ready ? 1 : 0 }}>
          <HeroScene key={phone ? "phone" : "desk"} layout={layout} stage={stage} active={visible} onReady={onReady} />
        </div>
      )}

      <div className="relative z-10 mx-auto flex h-full max-w-[1320px] flex-col items-center justify-center px-5 text-center md:px-8">
        <h1 className="font-display text-[clamp(52px,9.4vw,148px)] leading-[0.88] tracking-[-0.025em]">
          <span className="kit-line">
            <span className="kit-line-inner">Your products,</span>
          </span>
          <span className="kit-line">
            <span className="kit-line-inner italic" style={{ animationDelay: "90ms" }}>
              on their table.
            </span>
          </span>
        </h1>
        <p className="kit-load mt-6 max-w-[34rem] text-[17px] leading-[1.5] text-ink/80 md:mt-8 md:text-[19px]" style={{ animationDelay: "260ms" }}>
          Snap one photo. Every product becomes 3D. Share one link: customers place it in their room, ask questions, and order on WhatsApp.
        </p>
        <div className="kit-load mt-8 flex flex-col items-center gap-2 sm:flex-row sm:gap-3 md:mt-9" style={{ animationDelay: "360ms" }}>
          <Link
            href="/new?mode=shop"
            className="kit-press inline-flex h-14 items-center rounded-full bg-cobalt-500 px-8 text-[17px] font-medium text-white hover:bg-cobalt-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cobalt-500"
          >
            Make your shop link
          </Link>
          <Link
            href="/k/sample-shop"
            className="kit-press group inline-flex h-14 items-center gap-2 rounded-full px-6 text-[17px] font-medium text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-cobalt-500"
          >
            See a sample shop
            <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
        <p className="kit-load mt-5 text-[14px] text-ink-muted" style={{ animationDelay: "440ms" }}>
          Free to try. No sign-up. Works with the phone camera you already have.
        </p>
      </div>
    </section>
  );
}

export function Nav() {
  return (
    <header className="relative z-20 mx-auto flex h-20 max-w-[1320px] items-center justify-between px-5 text-[15px] md:px-8">
      <Link href="/" className="font-display text-[34px] leading-none" aria-label="Kit, home">
        Kit
      </Link>
      <nav className="hidden items-center gap-9 text-ink/70 md:flex" aria-label="Main">
        <a href="#customer" className="transition-colors hover:text-ink">
          What customers see
        </a>
        <a href="#how" className="transition-colors hover:text-ink">
          How it works
        </a>
        <a href="#creators" className="transition-colors hover:text-ink">
          For creators
        </a>
        <Link href="/dashboard" className="transition-colors hover:text-ink">
          My shops
        </Link>
      </nav>
      <Link href="/new?mode=shop" className="kit-press inline-flex h-11 items-center rounded-full bg-ink px-5 font-medium text-white hover:bg-ink-soft">
        Make a shop link
      </Link>
    </header>
  );
}
