"use client";

// Section entrance: children marked `data-r` (with a `--i` order) rise in once as the section enters.
// Armed only after hydration and only when the section starts below the fold, so without script,
// or for a section already on screen, everything is simply visible.

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

export function Reveal({ as: Tag = "div", className, children, id, "aria-label": label }: { as?: ElementType; className?: string; children: ReactNode; id?: string; "aria-label"?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    setArmed(true);
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <Tag ref={ref} id={id} aria-label={label} className={className} data-armed={armed ? "" : undefined} data-shown={shown ? "" : undefined}>
      {children}
    </Tag>
  );
}
