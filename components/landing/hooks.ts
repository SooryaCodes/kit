"use client";

import { useEffect, useState, type RefObject } from "react";

/** True when the user asked for less motion. Starts false on the server and first paint. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

let webglCache: boolean | null = null;

/** null until checked on the client, then whether WebGL can run here. */
export function useWebGL(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (webglCache === null) {
      try {
        const c = document.createElement("canvas");
        webglCache = !!(c.getContext("webgl2") || c.getContext("webgl"));
      } catch {
        webglCache = false;
      }
    }
    setOk(webglCache);
  }, []);
  return ok;
}

/** Live 3D is allowed: WebGL works and the user did not ask for reduced motion. */
export function useLive3D(): boolean {
  const gl = useWebGL();
  const reduced = useReducedMotion();
  return gl === true && !reduced;
}

/**
 * Whether an element is on screen (`visible`) and whether it has ever come near (`near`, sticky).
 * `near` mounts heavy things a screen early; `visible` pauses them when they leave.
 */
export function useInView(ref: RefObject<Element | null>, margin = "100% 0px"): { near: boolean; visible: boolean } {
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nearObs = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) setNear(true);
    }, { rootMargin: margin });
    const visObs = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { rootMargin: "10% 0px" });
    nearObs.observe(el);
    visObs.observe(el);
    return () => {
      nearObs.disconnect();
      visObs.disconnect();
    };
  }, [ref, margin]);
  return { near, visible };
}

/** Viewport is phone-sized. */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}
