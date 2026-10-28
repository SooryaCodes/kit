// Closing call to action and the footer. The sample bag's items rest along the bottom edge like on a table.

import Link from "next/link";
import { CREDITS, cut } from "./data";
import { Reveal } from "./reveal";

const SHELF = [
  { id: 14, h: 60, r: -6 },
  { id: 6, h: 96, r: 4 },
  { id: 12, h: 118, r: -3 },
  { id: 0, h: 190, r: 0 },
  { id: 3, h: 104, r: 6 },
  { id: 7, h: 86, r: -4 },
  { id: 15, h: 84, r: 8 },
];

export function Closing() {
  return (
    <Reveal as="section" className="relative overflow-hidden bg-studio" aria-label="Make your Reel">
      <div className="pointer-events-none absolute inset-0 bg-grid" aria-hidden />
      <div className="relative mx-auto max-w-[1320px] px-5 pb-10 pt-28 text-center md:px-8 md:pt-40">
        <h2 data-r style={{ ["--i" as string]: 0 }} className="font-display text-[clamp(52px,8vw,132px)] leading-[0.88] tracking-[-0.025em]">
          Empty your bag.
          <br />
          <span className="italic">Make the Reel.</span>
        </h2>
        <p data-r style={{ ["--i" as string]: 1 }} className="mx-auto mt-7 max-w-[30rem] text-[17px] leading-[1.5] text-ink-soft md:text-[19px]">
          One photo is all it takes. Free, no sign-up.
        </p>
        <div data-r style={{ ["--i" as string]: 2 }} className="mt-9 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
          <Link
            href="/new"
            className="kit-press inline-flex h-14 items-center rounded-full bg-cobalt-500 px-8 text-[17px] font-medium text-white hover:bg-cobalt-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cobalt-500"
          >
            Make your Reel
          </Link>
          <Link href="/new?template=bag" className="kit-press group inline-flex h-14 items-center gap-2 rounded-full px-6 text-[17px] font-medium hover:bg-ink/5">
            Try the sample bag
            <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>

        <div data-r style={{ ["--i" as string]: 3 }} className="mt-16 flex items-end justify-center gap-3 md:mt-24 md:gap-7" aria-hidden>
          {SHELF.map((s, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={s.id}
              src={cut("bag", s.id)}
              alt=""
              loading="lazy"
              className={`shadow-object w-auto transition-transform duration-500 hover:-translate-y-2 ${i === 0 || i === SHELF.length - 1 ? "hidden sm:block" : ""}`}
              style={{ height: `clamp(${Math.round(s.h * 0.45)}px, ${(s.h / 14.4).toFixed(2)}vw, ${s.h}px)`, rotate: `${s.r}deg` }}
            />
          ))}
        </div>
      </div>
    </Reveal>
  );
}

export function Footer() {
  return (
    <footer className="relative bg-ink text-paper">
      <div className="mx-auto flex max-w-[1320px] flex-col items-center px-5 py-16 text-center md:px-8 md:py-20">
        <Link href="/" className="font-display text-[88px] leading-none md:text-[120px]" aria-label="Kit, home">
          Kit
        </Link>
        <p className="mt-4 max-w-[26rem] text-[16px] leading-[1.5] text-paper/70">Photograph your things. Get them back in 3D, ready to post.</p>
        <nav className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-[16px]" aria-label="Footer">
          <Link href="/new" className="text-paper hover:text-cobalt-200">
            Make a Reel
          </Link>
          <a href="#formats" className="text-paper/80 hover:text-paper">
            Templates
          </a>
          <a href="#how" className="text-paper/80 hover:text-paper">
            How it works
          </a>
          <Link href="/reels" className="text-paper/80 hover:text-paper">
            My Reels
          </Link>
        </nav>
        <p className="mt-12 max-w-[44rem] text-[13px] leading-[1.7] text-paper/55">
          Built on Meta&rsquo;s Muse Spark, SAM 3.1, SAM 3D Objects and Muse Image.
          <br />
          Sample photos:{" "}
          {CREDITS.map((c, i) => (
            <span key={c.what}>
              {c.what.toLowerCase()} by {c.who} ({c.where}){i < CREDITS.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>
      </div>
    </footer>
  );
}
