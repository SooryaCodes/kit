"use client";

// One product in 3D with <model-viewer>: spin and zoom in the page, and "See it in your room" in AR at real size
// (WebXR or Scene Viewer on Android, Quick Look on iPhone). The element is loaded on demand, in the browser only.

import { useEffect, useRef, useState } from "react";

type ModelViewerElement = HTMLElement & { canActivateAR?: boolean; activateAR?: () => Promise<void> };

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, unknown>;
    }
  }
}

let loading: Promise<unknown> | undefined;
// Kit's models are meshopt-compressed; model-viewer loads its decoder from a script that defines MeshoptDecoder
const MESHOPT_DECODER = "/vendor/meshopt_decoder-1.3.0.js";
const loadModelViewer = () =>
  (loading ??= import("@google/model-viewer").then(({ ModelViewerElement }) => {
    (ModelViewerElement as unknown as { meshoptDecoderLocation: string }).meshoptDecoderLocation = MESHOPT_DECODER;
  }));

export function ProductModel({
  src,
  arSrc,
  alt,
  poster,
  onArStart,
}: {
  src: string;
  /** real-size model; AR is offered only when there is one */
  arSrc: string | null;
  alt: string;
  poster?: string | null;
  onArStart?: () => void;
}) {
  const ref = useRef<ModelViewerElement>(null);
  const [ready, setReady] = useState(false);
  const [canAr, setCanAr] = useState(false);

  useEffect(() => {
    let live = true;
    loadModelViewer().then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    const onLoad = () => setCanAr(Boolean(arSrc && el.canActivateAR));
    const onAr = (e: Event) => {
      if ((e as CustomEvent<{ status: string }>).detail?.status === "session-started") onArStart?.();
    };
    el.addEventListener("load", onLoad);
    el.addEventListener("ar-status", onAr);
    return () => {
      el.removeEventListener("load", onLoad);
      el.removeEventListener("ar-status", onAr);
    };
  }, [ready, arSrc, onArStart]);

  return (
    <div className="relative aspect-square w-full">
      {ready ? (
        <model-viewer
          ref={ref}
          src={arSrc ?? src}
          alt={alt}
          poster={poster ?? undefined}
          camera-controls=""
          auto-rotate=""
          auto-rotate-delay="0"
          rotation-per-second="18deg"
          interaction-prompt="none"
          shadow-intensity="1"
          shadow-softness="0.8"
          exposure="1.05"
          camera-orbit="30deg 62deg auto"
          {...(arSrc ? { ar: "", "ar-modes": "webxr scene-viewer quick-look", "ar-scale": "fixed", "ar-placement": "floor" } : {})}
          style={{ width: "100%", height: "100%", background: "transparent", ["--poster-color" as string]: "transparent" }}
        >
          <button slot="ar-button" className="hidden" aria-hidden tabIndex={-1} />
        </model-viewer>
      ) : (
        poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={alt} className="shadow-object absolute inset-0 m-auto max-h-[70%] max-w-[70%] object-contain" />
        )
      )}
      {canAr && (
        <button
          type="button"
          onClick={() => ref.current?.activateAR?.()}
          className="kit-press absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-[15px] font-medium text-white shadow-[0_10px_30px_-10px_rgb(22_21_20/.6)]"
        >
          See it in your room
        </button>
      )}
    </div>
  );
}
