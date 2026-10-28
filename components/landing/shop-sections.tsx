// The shop story: the questions every product post gets, what a customer sees on a Kit link (the real sample
// shop, live in a phone), and the same page for creators who recommend what they use.

import Link from "next/link";
import { cut } from "./data";
import { Reveal } from "./reveal";

const QUESTIONS = ["What size is it?", "Will my laptop fit?", "Can you show it from the side?", "Price?"];

export function Problem() {
  return (
    <Reveal as="section" id="problem" className="relative py-28 md:py-40" aria-label="The problem">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center px-5 text-center md:px-8">
        <h2 data-r style={{ ["--i" as string]: 0 }} className="font-display text-[clamp(34px,5.6vw,88px)] leading-[0.92] tracking-[-0.02em]">
          Every product post gets
          <br />
          <span className="italic">the same questions.</span>
        </h2>
        <div data-r style={{ ["--i" as string]: 1 }} className="mt-12 flex w-full max-w-[420px] flex-col gap-2.5 md:mt-16">
          {QUESTIONS.map((q, i) => (
            <p
              key={q}
              className={`w-fit max-w-[80%] rounded-[22px] px-5 py-3 text-left text-[17px] shadow-[0_10px_24px_-18px_rgb(40_30_20/.5)] ${i % 2 ? "self-end rounded-br-md bg-cobalt-500 text-white" : "self-start rounded-bl-md bg-card text-ink"}`}
            >
              {q}
            </p>
          ))}
        </div>
        <p data-r style={{ ["--i" as string]: 2 }} className="mt-12 max-w-[36rem] text-[17px] leading-[1.55] text-ink-soft md:mt-16 md:text-[19px]">
          Small sellers on Instagram and WhatsApp answer them one DM at a time, all day. A flat photo can&rsquo;t show size or the back, and a studio 3D model costs thousands of rupees for a single product. So a lot of people ask, and then don&rsquo;t buy.
        </p>
      </div>
    </Reveal>
  );
}

const CUSTOMER_STEPS = [
  { title: "Spin it in 3D", text: "Every product from the photo, rebuilt as a model they can turn and zoom." },
  { title: "See it in your room", text: "At its real size, on their own table, through the phone camera. No app to install." },
  { title: "Ask about it", text: "“Will a 14-inch laptop fit?” The shop assistant answers from the seller’s own measurements, and says when it isn’t sure." },
  { title: "Order on WhatsApp", text: "One tap opens WhatsApp with the product and price already written." },
];

export function CustomerView() {
  return (
    <Reveal as="section" id="customer" className="relative overflow-hidden bg-studio py-28 md:py-40" aria-label="What your customer sees">
      <div className="pointer-events-none absolute inset-0 bg-grid" aria-hidden />
      <div className="relative mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="text-center">
          <h2 data-r style={{ ["--i" as string]: 0 }} className="font-display text-[clamp(34px,5.6vw,88px)] leading-[0.92] tracking-[-0.02em]">
            One link. <span className="italic">Everything they ask.</span>
          </h2>
          <p data-r style={{ ["--i" as string]: 1 }} className="mx-auto mt-6 max-w-[34rem] text-[17px] leading-[1.5] text-ink-soft md:text-[19px]">
            Put it in your bio, your WhatsApp status and your customer groups. This is the real sample shop, live. Tap a bag.
          </p>
        </div>
        <div className="mt-14 grid items-center gap-12 md:mt-20 lg:grid-cols-2 lg:gap-16">
          <div data-r style={{ ["--i" as string]: 2 }} className="mx-auto h-[640px] w-[320px] overflow-hidden rounded-[46px] border-[10px] border-ink bg-paper shadow-[0_50px_90px_-50px_rgb(40_30_20/.6)] sm:h-[700px] sm:w-[350px]">
            <iframe src="/k/sample-shop" title="The sample shop, live" loading="lazy" className="size-full" />
          </div>
          <ol className="flex flex-col gap-8">
            {CUSTOMER_STEPS.map((s, i) => (
              <li key={s.title} data-r style={{ ["--i" as string]: i + 3 }} className="flex items-start gap-5">
                <span className="font-display flex size-12 shrink-0 items-center justify-center rounded-full bg-cobalt-500 text-[24px] leading-none text-white">{i + 1}</span>
                <div>
                  <p className="font-display text-[30px] leading-none md:text-[36px]">{s.title}</p>
                  <p className="mt-2 max-w-[30rem] text-[16px] leading-[1.55] text-ink-soft md:text-[17px]">{s.text}</p>
                </div>
              </li>
            ))}
            <li data-r style={{ ["--i" as string]: 7 }}>
              <Link href="/k/sample-shop" className="kit-press inline-flex h-12 items-center rounded-full bg-ink px-6 text-[16px] font-medium text-white">
                Open the sample shop
              </Link>
            </li>
          </ol>
        </div>
      </div>
    </Reveal>
  );
}

const BAG_ROW = [6, 0, 12, 3, 13];

export function Creators() {
  return (
    <Reveal as="section" id="creators" className="relative py-28 md:py-40" aria-label="For creators">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center px-5 text-center md:px-8">
        <h2 data-r style={{ ["--i" as string]: 0 }} className="font-display text-[clamp(34px,5.6vw,88px)] leading-[0.92] tracking-[-0.02em]">
          Made for creators <span className="italic">too.</span>
        </h2>
        <p data-r style={{ ["--i" as string]: 1 }} className="mt-6 max-w-[34rem] text-[17px] leading-[1.5] text-ink-soft md:text-[19px]">
          Post a &ldquo;what&rsquo;s in my bag&rdquo; or desk setup? Photograph it once. Kit names every item, you add your own buy links, and followers spin each one in 3D before they tap. No more pasting links under forty &ldquo;link?&rdquo; comments.
        </p>
        <div data-r style={{ ["--i" as string]: 2 }} className="mt-12 flex items-end justify-center gap-4 md:gap-8">
          {BAG_ROW.map((id) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={id} src={cut("bag", id)} alt="" className="shadow-object h-16 w-auto md:h-28" />
          ))}
        </div>
        <div data-r style={{ ["--i" as string]: 3 }} className="mt-12 flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
          <Link href="/new?mode=creator" className="kit-press inline-flex h-14 items-center rounded-full bg-cobalt-500 px-8 text-[17px] font-medium text-white hover:bg-cobalt-600">
            Make your page
          </Link>
          <Link href="/k/sample-bag" className="kit-press group inline-flex h-14 items-center gap-2 rounded-full px-6 text-[17px] font-medium hover:bg-ink/5">
            See a creator page
            <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </Reveal>
  );
}
