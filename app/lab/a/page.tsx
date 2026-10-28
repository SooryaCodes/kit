// Direction A · Studio: product-photography seamless paper, editorial serif, objects floating with real shadows.

import { Hanken_Grotesk, Instrument_Serif } from "next/font/google";
import { SCATTER } from "../cutouts";

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const sans = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"] });

export default function LabA() {
  return (
    <main className={`${sans.className} relative min-h-svh overflow-hidden text-[#161514]`} style={{ background: "radial-gradient(120% 90% at 50% 40%, #f4f2ee 0%, #e7e4de 70%, #dedad3 100%)" }}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "linear-gradient(to right, rgb(22 21 20 / .06) 1px, transparent 1px), linear-gradient(to bottom, rgb(22 21 20 / .06) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      <header className="relative z-20 mx-auto flex h-20 max-w-[1320px] items-center justify-between px-8 text-[15px]">
        <span className={`${serif.className} text-[34px] leading-none`}>Kit</span>
        <nav className="hidden items-center gap-9 text-[#161514]/70 md:flex">
          <span>Templates</span>
          <span>How it works</span>
          <span>My Reels</span>
        </nav>
        <span className="rounded-full bg-[#161514] px-5 py-2.5 font-medium text-white">Make a Reel</span>
      </header>

      <section className="relative mx-auto h-[calc(100svh-80px)] max-w-[1320px] px-8">
        {SCATTER.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.name}
            src={p.src}
            alt=""
            className="absolute"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, transform: `rotate(${p.r}deg)`, filter: "drop-shadow(0 30px 28px rgb(40 30 20 / .22)) drop-shadow(0 6px 6px rgb(40 30 20 / .18))" }}
          />
        ))}
        <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
          <h1 className={`${serif.className} text-[clamp(64px,9.4vw,148px)] leading-[0.88] tracking-[-0.025em]`}>
            Everything you carry,
            <br />
            <span className="italic">now in 3D.</span>
          </h1>
          <p className="mt-7 max-w-[34rem] text-[19px] leading-[1.5] text-[#161514]/75">
            Photograph your bag, desk or outfit. Kit cuts out every item, rebuilds each one as a real 3D model and turns it into a Reel.
          </p>
          <div className="mt-9 flex items-center gap-3">
            <span className="rounded-full bg-[#2b44ff] px-7 py-4 text-[17px] font-medium text-white">Make your Reel</span>
            <span className="rounded-full px-6 py-4 text-[17px] font-medium text-[#161514]">Try the sample bag →</span>
          </div>
        </div>
      </section>
    </main>
  );
}
