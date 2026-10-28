// Direction B · Showroom: near-black gallery, items lit like museum pieces on one plinth line, acid-lime accent.

import { Archivo, Geist } from "next/font/google";
import { ROW } from "../cutouts";

const display = Archivo({ subsets: ["latin"], axes: ["wdth"] });
const sans = Geist({ subsets: ["latin"], weight: ["400", "500"] });

export default function LabB() {
  return (
    <main className={`${sans.className} relative min-h-svh overflow-hidden bg-[#0b0b0c] text-[#f2f1ec]`}>
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(to right, rgb(255 255 255 / .035) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / .035) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
      <div className="pointer-events-none absolute left-1/2 top-[58%] h-[70vh] w-[90vw] -translate-x-1/2 -translate-y-1/2" style={{ background: "radial-gradient(closest-side, rgb(255 255 255 / .10), transparent)" }} />
      <header className="relative z-20 mx-auto flex h-20 max-w-[1360px] items-center justify-between px-8 text-[14px]">
        <span className={`${display.className} text-[26px] font-extrabold uppercase tracking-[-0.02em]`} style={{ fontStretch: "125%" }}>
          Kit
        </span>
        <nav className="hidden items-center gap-8 text-white/60 md:flex">
          <span>Templates</span>
          <span>How it works</span>
          <span>My Reels</span>
        </nav>
        <span className="rounded-md bg-[#d6ff3a] px-5 py-2.5 font-medium text-[#0b0b0c]">Make a Reel</span>
      </header>

      <section className="relative mx-auto flex min-h-[calc(100svh-80px)] max-w-[1360px] flex-col items-center px-8 pt-[6vh] text-center">
        <h1 className={`${display.className} text-[clamp(56px,8.6vw,140px)] font-extrabold uppercase leading-[0.86] tracking-[-0.035em]`} style={{ fontStretch: "125%" }}>
          Your stuff,
          <br />
          on display
        </h1>
        <p className="mt-7 max-w-[33rem] text-[18px] leading-[1.55] text-white/70">
          One photo of your bag, desk or fit. Every item cut out, rebuilt in 3D and lit like it belongs in a gallery. Then posted as a Reel.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <span className="rounded-md bg-[#d6ff3a] px-7 py-4 text-[16px] font-medium text-[#0b0b0c]">Make your Reel</span>
          <span className="rounded-md bg-white/10 px-6 py-4 text-[16px] font-medium">Watch a demo</span>
        </div>

        <div className="relative mt-auto flex w-full items-end justify-center gap-[2.2vw] pb-[7vh]">
          {ROW.map((p) => (
            <figure key={p.name} className="flex flex-col items-center gap-3" style={{ width: `${p.w}%` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={p.name} className="w-full" style={{ filter: "drop-shadow(0 24px 30px rgb(0 0 0 / .7)) brightness(1.06)" }} />
              <figcaption className="text-[12.5px] text-white/45">{p.name}</figcaption>
            </figure>
          ))}
          <div className="absolute bottom-[calc(7vh+26px)] left-[6%] right-[6%] h-px bg-white/10" />
        </div>
      </section>
    </main>
  );
}
