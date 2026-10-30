// The frame for the steps before the workspace (photo, products, 3D): a quiet bar with where you are,
// the work on the paper. The same bar from the first click to the published link.

import Link from "next/link";

export const STEPS = ["Photo", "Products", "3D", "Shop"] as const;

export function MakingFrame({ step, children, wide }: { step: number; children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="bg-studio relative isolate min-h-svh">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <header className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-3 px-4 md:px-8">
        <Link href="/" className="font-display text-[30px] leading-none text-ink" aria-label="Kit, home">
          Kit
        </Link>
        <ol className="flex items-center gap-0.5 text-[13px] sm:gap-1.5 sm:text-[14px]" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === step ? "step" : undefined}
              className={`rounded-full px-2.5 py-1.5 font-medium transition-colors sm:px-3 ${i === step ? "bg-ink text-white" : i < step ? "text-ink" : "text-ink-faint"}`}
            >
              {s}
            </li>
          ))}
        </ol>
        <Link href="/dashboard" className="hidden text-[15px] font-medium text-ink-muted hover:text-ink sm:block">
          My shops
        </Link>
      </header>
      <div className={`mx-auto w-full px-4 pb-24 pt-4 sm:px-6 sm:pt-8 ${wide ? "max-w-[1200px]" : "max-w-4xl text-center"}`}>{children}</div>
    </main>
  );
}
