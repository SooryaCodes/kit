// AR check for iPhone: four Quick Look links side by side, Apple's own sample first, so one look tells whether
// a greyed-out AR button comes from the phone or from Kit's files. Not linked from the site.

import type { Metadata } from "next";
import { publicUrl } from "@/lib/supabase/storage";
import { Device } from "./device";

export const metadata: Metadata = { title: "AR check · Kit", robots: { index: false } };

const BAG = "8f2df8b4-7367-4b04-8f1a-603066df5242";

function tile(label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" rx="28" fill="#e9e6df"/><text x="120" y="132" font-family="-apple-system,Helvetica" font-size="22" text-anchor="middle" fill="#161514">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function ArCheck() {
  const tests = [
    { n: 1, title: "Apple's own sample", note: "A baseball glove from Apple's Quick Look gallery.", href: "https://developer.apple.com/quick-look-gallery/models/baseball-glove/glove_baseball_mtl_variant.usdz" },
    { n: 2, title: "Kit bag, as Kit writes it", note: "The USDZ the shop serves, opened directly.", href: publicUrl("glbs", `ar/${BAG}/240mm-upright.usdz`) },
    { n: 3, title: "Kit bag, binary scene", note: "The same bag repackaged with Pixar's ARKit tool.", href: publicUrl("glbs", "ar/check/bag-usdc.usdz") },
    { n: 4, title: "Kit bag, as the shop opens it", note: "Through the shop's link, at fixed real size.", href: `/api/ar/${BAG}?v=240-upright&format=usdz#allowsContentScaling=0` },
  ];
  return (
    <main className="bg-studio relative isolate min-h-svh">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <div className="mx-auto flex max-w-[560px] flex-col items-center gap-6 px-4 py-10 text-center">
        <h1 className="font-display text-[44px] leading-[0.95] text-ink">AR check</h1>
        <p className="text-[15px] text-ink-soft">Tap each one in Safari. In Quick Look, see whether the AR button at the top is available or greyed out.</p>
        <ol className="grid w-full grid-cols-2 gap-4">
          {tests.map((t) => (
            <li key={t.n} className="flex flex-col items-center gap-2">
              <a rel="ar" href={t.href} className="block w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tile(String(t.n))} alt={t.title} className="w-full rounded-3xl" />
              </a>
              <span className="text-[15px] font-medium text-ink">
                {t.n}. {t.title}
              </span>
              <span className="text-[13px] text-ink-muted">{t.note}</span>
            </li>
          ))}
        </ol>
        <Device />
      </div>
    </main>
  );
}
