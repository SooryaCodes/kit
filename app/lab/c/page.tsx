// Direction C · Sticker drop: die-cut sticker cutouts with white borders on warm paper, friendly heavy grotesk, tangerine accent.

import { Bricolage_Grotesque } from "next/font/google";
import { SCATTER } from "../cutouts";

const font = Bricolage_Grotesque({ subsets: ["latin"], axes: ["wdth", "opsz"] });

const sticker = "drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff) drop-shadow(3px 3px 0 #fff) drop-shadow(-3px -3px 0 #fff) drop-shadow(0 14px 18px rgb(60 30 10 / .25))";

export default function LabC() {
  return (
    <main className={`${font.className} relative min-h-svh overflow-hidden bg-[#f3eee4] text-[#1d1a16]`}>
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(to right, rgb(29 26 22 / .05) 1px, transparent 1px), linear-gradient(to bottom, rgb(29 26 22 / .05) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <header className="relative z-20 mx-auto flex h-20 max-w-[1320px] items-center justify-between px-8 text-[16px]">
        <span className="text-[30px] font-extrabold tracking-[-0.04em]">kit.</span>
        <nav className="hidden items-center gap-8 font-medium text-[#1d1a16]/70 md:flex">
          <span>Templates</span>
          <span>How it works</span>
          <span>My Reels</span>
        </nav>
        <span className="rounded-full bg-[#1d1a16] px-5 py-2.5 font-medium text-white">Make a Reel</span>
      </header>
      <section className="relative mx-auto h-[calc(100svh-80px)] max-w-[1320px] px-8">
        {SCATTER.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.name} src={p.src} alt="" className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, transform: `rotate(${p.r * 1.4}deg)`, filter: sticker }} />
        ))}
        <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
          <h1 className="text-[clamp(64px,9.2vw,150px)] font-extrabold leading-[0.86] tracking-[-0.05em]" style={{ fontVariationSettings: "'wdth' 90" }}>
            Dump your bag.
            <br />
            Get a 3D Reel.
          </h1>
          <p className="mt-6 max-w-[33rem] text-[20px] font-medium leading-[1.45] text-[#1d1a16]/75">
            One photo in. Every item comes out as its own 3D model, animated into a Reel you can post today.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <span className="rounded-full bg-[#ff5a1f] px-7 py-4 text-[18px] font-medium text-white">Make your Reel</span>
            <span className="rounded-full bg-white px-6 py-4 text-[18px] font-medium">Try a sample</span>
          </div>
        </div>
      </section>
    </main>
  );
}
