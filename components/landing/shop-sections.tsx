// The shop story: the questions every product post gets, what a customer sees on a Kit link (the real sample
// shop, live in a phone), and the same page for creators who recommend what they use.

import Link from "next/link";
import { cut } from "./data";
import { Reveal } from "./reveal";

/** An illustration of a seller's morning: the same few questions from different customers, none answered yet. */
const INBOX = [
  { name: "Riya", tint: "#dfe3ff", text: "What size is the tan one?", ago: "2m" },
  { name: "Arjun", tint: "#e7e4de", text: "Will my 14 inch laptop fit?", ago: "6m" },
  { name: "Neha", tint: "#c2caff", text: "Can you show the back?", ago: "11m" },
  { name: "Fathima", tint: "#dedad3", text: "Price for the green one?", ago: "18m" },
  { name: "Vishnu", tint: "#eef0ff", text: "Will my laptop fit in this?", ago: "24m" },
  { name: "Ann", tint: "#e7e4de", text: "What size? Any side photo?", ago: "31m" },
];

export function Problem() {
  return (
    <Reveal as="section" id="problem" className="relative py-28 md:py-40" aria-label="The problem">
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="text-center">
          <h2 data-r style={{ ["--i" as string]: 0 }} className="font-display text-[clamp(34px,5.6vw,88px)] leading-[0.92] tracking-[-0.02em]">
            Every product post gets
            <br />
            <span className="italic">the same questions.</span>
          </h2>
          <p data-r style={{ ["--i" as string]: 1 }} className="mx-auto mt-6 max-w-[36rem] text-[17px] leading-[1.55] text-ink-soft md:text-[19px]">
            A flat photo can&rsquo;t show size or the back, so customers ask, one DM at a time. By the time the seller replies, most have moved on.
          </p>
        </div>

        <div className="mt-14 grid items-start gap-10 md:mt-20 lg:grid-cols-2 lg:gap-16">
          {/* the seller's inbox, before */}
          <figure data-r style={{ ["--i" as string]: 2 }} className="mx-auto w-full max-w-[440px]">
            <div data-ui className="overflow-hidden rounded-[32px] bg-card ring-1 ring-paper-shade">
              <div className="flex items-center justify-between px-6 pb-3 pt-6">
                <p className="text-[19px] font-semibold text-ink">Messages</p>
                <span className="rounded-full bg-ink px-2.5 py-1 text-[12px] font-semibold text-white">23 unread</span>
              </div>
              <ul>
                {INBOX.map((m) => (
                  <li key={m.name} className="flex items-center gap-3 px-6 py-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full text-[16px] font-semibold text-ink-soft" style={{ background: m.tint }}>
                      {m.name.charAt(0)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-semibold text-ink">{m.name}</span>
                      <span className="truncate text-[15px] text-ink">{m.text}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-[12px] text-ink-muted">{m.ago}</span>
                      <span className="size-2.5 rounded-full bg-cobalt-500" aria-label="unread" />
                    </span>
                  </li>
                ))}
              </ul>
              <p className="px-6 pb-6 pt-2 text-[14px] text-ink-muted">You: Sending photos in a bit, so sorry for the wait&hellip;</p>
            </div>
            <figcaption className="mt-4 text-center text-[15px] text-ink-soft">A seller&rsquo;s morning today. Three questions, asked again and again.</figcaption>
          </figure>

          {/* the same question on a Kit product page, after */}
          <figure data-r style={{ ["--i" as string]: 3 }} className="mx-auto w-full max-w-[440px]">
            <div data-ui className="overflow-hidden rounded-[32px] bg-card ring-1 ring-paper-shade">
              <div className="bg-studio flex items-center justify-center px-6 py-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cut("shop", 1)} alt="The orange leather sling" className="shadow-object h-36 w-auto" />
              </div>
              <div className="flex flex-col gap-3 px-6 pb-6 pt-5">
                <div className="flex items-baseline justify-between">
                  <p className="font-display text-[30px] leading-none text-ink">Orange Leather Sling</p>
                  <p className="text-[17px] text-ink-soft">₹1,450</p>
                </div>
                <p className="text-[14px] text-ink-muted">About 24 cm on its longest side. Shown at real size in your room.</p>
                <p className="mt-1 self-end rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[15px] text-white">Will my 14 inch laptop fit?</p>
                <p className="self-start rounded-2xl rounded-bl-md bg-cobalt-50 px-4 py-2.5 text-[15px] text-ink">
                  No. A 14-inch laptop is about 32 cm wide and this sling is 24 cm. It fits a phone, keys and cards.
                </p>
                <span className="mt-1 flex h-12 items-center justify-center rounded-full bg-cobalt-500 text-[16px] font-medium text-white">Order on WhatsApp</span>
              </div>
            </div>
            <figcaption className="mt-4 text-center text-[15px] text-ink-soft">The same question on a Kit link, answered at once from the seller&rsquo;s own measurements.</figcaption>
          </figure>
        </div>
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
          <div data-r style={{ ["--i" as string]: 2 }} className="mx-auto h-[640px] w-[320px] overflow-hidden rounded-[46px] border-[10px] border-ink bg-paper  sm:h-[700px] sm:w-[350px]">
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

export function SellerStudio({ children }: { children: React.ReactNode }) {
  return (
    <Reveal as="section" id="studio" className="relative py-28 md:py-40" aria-label="The seller's studio">
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <div className="text-center">
          <h2 data-r style={{ ["--i" as string]: 0 }} className="font-display text-[clamp(34px,5.6vw,88px)] leading-[0.92] tracking-[-0.02em]">
            Your side: <span className="italic">one studio.</span>
          </h2>
          <p data-r style={{ ["--i" as string]: 1 }} className="mx-auto mt-6 max-w-[36rem] text-[17px] leading-[1.5] text-ink-soft md:text-[19px]">
            Muse Spark names every product and estimates its size. You check the price and the size, then publish. This is the real studio on the sample shop: pick a bag, turn it, edit it.
          </p>
        </div>
        <div data-r style={{ ["--i" as string]: 2 }} className="mt-14 md:mt-20">
          {children}
        </div>
      </div>
    </Reveal>
  );
}
