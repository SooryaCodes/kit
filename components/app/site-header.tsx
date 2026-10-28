"use client";

// The one header for every screen: wordmark, a few plain links, one action. Sticky on solid paper.
// On phones the links fold into a full-screen menu behind a two-line button.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const SITE_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#customer", label: "What customers see" },
  { href: "/#creators", label: "For creators" },
  { href: "/k/sample-shop", label: "Sample shop" },
];

export function SiteHeader({ variant = "site", action = true }: { variant?: "site" | "app"; action?: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const links = variant === "site" ? SITE_LINKS : [];

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className={`sticky top-0 z-40 transition-colors duration-300 ${scrolled || open ? "bg-paper" : "bg-transparent"}`}>
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-6 px-5 md:h-20 md:px-8">
          <Link href="/" className="font-display text-[32px] leading-none text-ink transition-opacity hover:opacity-70" aria-label="Kit, home">
            Kit
          </Link>

          <nav className="hidden items-center gap-8 text-[15px] text-ink-soft lg:flex" aria-label="Main">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="hidden rounded-full px-4 py-2.5 text-[15px] font-medium text-ink-soft transition-colors hover:text-ink sm:inline-flex">
              My shops
            </Link>
            {action && (
              <Link href="/new?mode=shop" className="kit-press hidden h-11 items-center rounded-full bg-ink px-5 text-[15px] font-medium text-white hover:bg-ink-soft sm:inline-flex">
                Make a shop link
              </Link>
            )}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="flex size-11 flex-col items-center justify-center gap-[6px] rounded-full transition-colors hover:bg-ink/5 lg:hidden"
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? "Close menu" : "Open menu"}
            >
              <span className={`block h-[2px] w-5 rounded-full bg-ink transition-transform duration-300 ${open ? "translate-y-[4px] rotate-45" : ""}`} />
              <span className={`block h-[2px] w-5 rounded-full bg-ink transition-transform duration-300 ${open ? "-translate-y-[4px] -rotate-45" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      <div
        id="site-menu"
        className={`fixed inset-x-0 bottom-0 top-16 z-30 flex flex-col bg-paper px-6 pb-[max(env(safe-area-inset-bottom),28px)] pt-8 transition-[opacity,transform] duration-300 md:top-20 lg:hidden ${open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"}`}
        aria-hidden={!open}
      >
        <nav className="flex flex-col gap-1" aria-label="Menu">
          {[...links, { href: "/dashboard", label: "My shops" }].map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              className="font-display py-2 text-[44px] leading-[1.05] text-ink transition-[opacity,transform] duration-500"
              style={{ transitionDelay: open ? `${60 + i * 50}ms` : "0ms", opacity: open ? 1 : 0, transform: open ? "none" : "translateY(10px)" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <Link href="/new?mode=shop" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} className="flex h-14 items-center justify-center rounded-full bg-cobalt-500 text-[17px] font-medium text-white">
            Make a shop link
          </Link>
          <p className="text-center text-[14px] text-ink-muted">One photo of your products. Free, no sign-up.</p>
        </div>
      </div>
    </>
  );
}
