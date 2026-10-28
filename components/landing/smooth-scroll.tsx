"use client";

// Gentle smooth scrolling for the landing page. Off for reduced motion and touch (native scroll is better there).

import Lenis from "lenis";
import { useEffect } from "react";

export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, anchors: true });
    let id = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      id = requestAnimationFrame(raf);
    };
    id = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
    };
  }, []);
  return null;
}
