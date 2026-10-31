"use client";

// "See all in your room": the whole shop as one real-size AR model. On a phone the first tap loads it and the
// second opens AR (iPhone only opens AR straight from a tap, so it can't wait for a download in between).
// On a computer it shows a QR code that opens the shop on a phone, ready to place.

import { useEffect, useRef, useState } from "react";
import { QrCode } from "@/components/studio/share";
import { isInAppBrowser } from "@/lib/shop/links";
import { loadModelViewer, type ModelViewerElement } from "./product-model";

type State = "idle" | "loading" | "ready" | "unsupported" | "in-app";

// a short fingerprint of the products, their order, sizes and poses, so a change is never served from a cached link
function version(arUrls: string[]): string {
  let h = 5381;
  for (const c of arUrls.join("|")) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

export function ShopRoomButton({ slug, arUrls, pageUrl, onStart }: { slug: string; arUrls: string[]; pageUrl: string; onStart?: () => void }) {
  const count = arUrls.length;
  const [phone, setPhone] = useState<boolean | null>(null);
  const [state, setState] = useState<State>("idle");
  const [qr, setQr] = useState(false);
  const ref = useRef<ModelViewerElement | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    setPhone(/Android|iPhone|iPad|iPod/i.test(ua));
    if (isInAppBrowser(ua)) setState("in-app");
    // a QR code from a computer opens the shop with ?room=1: start loading so one tap places it
    if (/Android|iPhone|iPad|iPod/i.test(ua) && new URL(window.location.href).searchParams.get("room") === "1" && !isInAppBrowser(ua)) void prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function prepare() {
    setState("loading");
    await loadModelViewer();
    const el = document.createElement("model-viewer") as ModelViewerElement;
    el.setAttribute("src", `/api/ar/shop/${slug}?v=${version(arUrls)}`);
    el.setAttribute("ar", "");
    el.setAttribute("ar-modes", "webxr scene-viewer quick-look");
    el.setAttribute("ar-scale", "fixed");
    el.setAttribute("ar-placement", "floor");
    el.setAttribute("alt", `All ${count} products, at real size`);
    // model-viewer only loads once its element is on screen, so it sits inside the viewport, invisible, and loads eagerly
    el.setAttribute("loading", "eager");
    el.style.cssText = "position:fixed;width:2px;height:2px;left:0;bottom:0;opacity:0;pointer-events:none";
    el.addEventListener("load", () => setState(el.canActivateAR ? "ready" : "unsupported"));
    el.addEventListener("error", () => setState("unsupported"));
    el.addEventListener("ar-status", (e) => {
      if ((e as CustomEvent<{ status: string }>).detail?.status === "session-started") onStart?.();
    });
    document.body.appendChild(el);
    ref.current = el;
  }

  useEffect(() => () => ref.current?.remove(), []);

  if (phone === null || count < 2) return null;

  if (!phone) {
    return (
      <div className="relative">
        <button type="button" onClick={() => setQr((q) => !q)} className="kit-press flex h-11 items-center rounded-full bg-paper-deep px-5 text-[15px] font-medium text-ink hover:bg-paper-shade" aria-expanded={qr}>
          See all {count} in your room
        </button>
        {qr && (
          <div className="absolute left-1/2 top-[calc(100%+10px)] z-20 flex w-[280px] -translate-x-1/2 flex-col items-center gap-3 rounded-3xl bg-card p-5 text-center shadow-[0_24px_48px_-24px_rgb(40_30_20/.45)]">
            <QrCode url={`${pageUrl}?room=1`} size={150} />
            <p className="text-[14px] leading-[1.45] text-ink-soft">Scan with your phone to place all {count} products on your floor, at real size.</p>
          </div>
        )}
      </div>
    );
  }

  const label =
    state === "loading" ? "Preparing your room view…" : state === "ready" ? `Place all ${count} in your room` : `See all ${count} in your room`;
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={state === "loading"}
        onClick={async () => {
          if (state === "in-app") {
            try {
              await navigator.clipboard.writeText(`${pageUrl}?room=1`);
            } catch {
              // clipboard blocked: the note below still says what to do
            }
            setState("in-app");
            return;
          }
          if (state === "ready" && ref.current?.activateAR) return ref.current.activateAR();
          if (state === "idle") return prepare();
        }}
        className={`kit-press flex h-11 items-center rounded-full px-5 text-[15px] font-medium disabled:opacity-70 ${state === "ready" ? "bg-cobalt-500 text-white" : "bg-paper-deep text-ink"}`}
      >
        {label}
      </button>
      {state === "in-app" && <p className="max-w-[30ch] text-[13px] text-ink-muted">Open this page in Safari or Chrome to see it in your room. Tap to copy the link.</p>}
      {state === "unsupported" && <p className="max-w-[30ch] text-[13px] text-ink-muted">This browser can&apos;t open AR. Try Chrome on Android or Safari on iPhone.</p>}
    </div>
  );
}
