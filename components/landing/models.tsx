"use client";

// Built on Meta's models: the chain from photo to Reel, each step shown by its real output for the sample bag.

import dynamic from "next/dynamic";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { BAG_ITEMS, BAG_PHOTO, cut, glb } from "./data";
import { useInView, useLive3D } from "./hooks";
import { Reveal } from "./reveal";

const SpinModel = dynamic(() => import("./spin-model"), { ssr: false });

function Step({ i, picture, name, text, last }: { i: number; picture: ReactNode; name: string; text: string; last?: boolean }) {
  return (
    <li data-r style={{ ["--i" as string]: i + 2 }} className={`relative flex flex-col items-center text-center ${last ? "col-span-2 lg:col-span-1" : ""}`}>
      <div className="relative flex h-[170px] w-full items-center justify-center sm:h-[230px] md:h-[250px]">{picture}</div>
      <p className="font-display mt-5 text-[26px] leading-none md:mt-6 md:text-[30px]">{name}</p>
      <p className="mt-3 max-w-[16rem] text-[15px] leading-[1.5] text-ink-soft md:text-[16px]">{text}</p>
      {!last && (
        <span aria-hidden className="absolute -right-4 top-[115px] hidden translate-x-1/2 text-[22px] text-ink-faint lg:block md:top-[125px]">
          →
        </span>
      )}
    </li>
  );
}

function SpinPicture() {
  const live = useLive3D();
  const ref = useRef<HTMLDivElement>(null);
  const { near, visible } = useInView(ref, "60% 0px");
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  return (
    <div ref={ref} className="relative h-full w-full max-w-[260px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cut("bag", 6)}
        alt=""
        className="shadow-object absolute left-1/2 top-1/2 w-[62%] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500"
        style={{ opacity: live && ready ? 0 : 1 }}
      />
      {live && near && (
        <div className="absolute inset-0 transition-opacity duration-500" style={{ opacity: ready ? 1 : 0 }}>
          <SpinModel url={glb("bag", 6)} active={visible} onReady={onReady} />
        </div>
      )}
    </div>
  );
}

export function Models() {
  const names = BAG_ITEMS.map((i) => i.name);
  return (
    <Reveal as="section" id="models" className="relative py-28 md:py-40" aria-label="Built on Meta's models">
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <div className="text-center">
          <h2 data-r style={{ ["--i" as string]: 0 }} className="font-display text-[clamp(34px,5.6vw,88px)] leading-[0.92] tracking-[-0.02em]">
            Four Meta models, <span className="italic">one chain.</span>
          </h2>
          <p data-r style={{ ["--i" as string]: 1 }} className="mx-auto mt-6 max-w-[34rem] text-[17px] leading-[1.5] text-ink-soft md:text-[19px]">
            Kit is built on Meta&rsquo;s models. They do the seeing, cutting and building. Below are their real outputs for the sample bag.
          </p>
        </div>

        <ol className="mt-16 grid grid-cols-2 gap-x-5 gap-y-14 md:mt-24 lg:grid-cols-5 lg:gap-x-8">
          <Step
            i={0}
            name="Your photo"
            text="One picture of your things, laid out flat. A phone shot is enough."
            picture={
              // eslint-disable-next-line @next/next/no-img-element
              <img src={BAG_PHOTO.src} alt="The sample flat-lay photo of a backpack and its contents" className="w-[86%] max-w-[240px] -rotate-2 shadow-[0_18px_30px_-18px_rgb(40_30_20/0.45)]" />
            }
          />
          <Step
            i={1}
            name="Muse Spark"
            text="Reads the photo and lists every item in it, with a name for each."
            picture={
              <div className="w-[86%] max-w-[230px] rotate-1 rounded-[6px] bg-card px-5 py-4 text-left shadow-[0_18px_30px_-18px_rgb(40_30_20/0.35)]">
                <p className="text-[14px] font-semibold">14 items found</p>
                <ul className="mt-2 text-[13px] leading-[1.55] text-ink-soft sm:columns-2 sm:gap-3">
                  {names.map((n, k) => (
                    <li key={`${n}-${k}`} className={k >= 6 ? "hidden sm:list-item" : undefined}>
                      {n}
                    </li>
                  ))}
                  <li className="sm:hidden">and {names.length - 6} more</li>
                </ul>
              </div>
            }
          />
          <Step
            i={2}
            name="SAM 3.1"
            text="Draws a clean mask round each listed item and cuts it out."
            picture={
              <div className="relative w-[70%] max-w-[200px]">
                {/* the mask, as SAM returns it, under the cutout it makes */}
                <div
                  aria-hidden
                  className="absolute inset-0 -translate-x-[9%] -translate-y-[12%] bg-cobalt-500"
                  style={{ maskImage: `url(${cut("bag", 6)})`, WebkitMaskImage: `url(${cut("bag", 6)})`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cut("bag", 6)} alt="The headphones, cut out from the photo" className="shadow-object relative w-full translate-x-[6%] translate-y-[8%]" />
              </div>
            }
          />
          <Step i={3} name="SAM 3D Objects" text="Rebuilds every cutout as a textured 3D model. These headphones are a 292 KB GLB." picture={<SpinPicture />} />
          <Step
            i={4}
            last
            name="The Reel"
            text="Paints a themed backdrop for the template. Kit animates the scene and exports the MP4."
            picture={
              <div className="flex h-full w-[96px] flex-col items-center rounded-[16px] bg-cobalt-500 px-3 pt-4 text-white shadow-[0_24px_36px_-22px_rgb(14_22_96/0.6)] sm:w-[130px] md:w-[141px]">
                <p className="font-display text-[14px] leading-none sm:text-[19px]">What&rsquo;s in my bag</p>
                <div className="mt-2 grid min-h-0 flex-1 grid-cols-2 place-items-center gap-1 pb-3 sm:mt-3 sm:gap-1.5 sm:pb-4">
                  {[6, 0, 12, 1, 3, 2].map((id) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={id} src={cut("bag", id)} alt="" className="max-h-[24px] w-auto max-w-[34px] object-contain sm:max-h-[42px] sm:max-w-[48px]" />
                  ))}
                </div>
              </div>
            }
          />
        </ol>
      </div>
    </Reveal>
  );
}
