"use client";

// Sharing a published page: the link, copy, WhatsApp share and a QR code for the seller's own phone
// (the quickest way to try "See it in your room" from a laptop). Shown as a dialog the moment a page first goes live.

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function QrCode({ url, size = 168 }: { url: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(url, { margin: 1, width: size * 2, color: { dark: "#161514", light: "#fbfaf8" } }).then((d) => live && setSrc(d));
    return () => {
      live = false;
    };
  }, [url, size]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={`QR code for ${url}`} width={size} height={size} className="rounded-xl" />
  ) : (
    <span className="block rounded-xl bg-paper-deep" style={{ width: size, height: size }} aria-hidden />
  );
}

export function whatsappShareUrl(link: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`See every product in 3D, place it in your room, and order on WhatsApp: ${link}`)}`;
}

export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-paper p-1.5 pl-3.5">
      <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{link.replace(/^https?:\/\//, "")}</span>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        className="h-9 shrink-0 rounded-lg bg-ink px-3.5 text-[14px] font-medium text-white"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function LiveDialog({ link, title, onClose }: { link: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby="live-h">
      <button type="button" className="absolute inset-0 bg-ink/40" onClick={onClose} aria-label="Close" />
      <div className="kit-settle relative flex w-full max-w-[460px] flex-col items-center gap-5 rounded-t-[32px] bg-card px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-8 text-center shadow-[0_30px_60px_-30px_rgb(40_30_20/.5)] sm:rounded-[32px] sm:pb-8">
        <div>
          <h2 id="live-h" className="font-display text-[44px] leading-[0.95] text-ink">
            {title} <span className="italic">is live</span>
          </h2>
          <p className="mt-2 text-[15px] text-ink-muted">Put the link in your Instagram bio and WhatsApp status.</p>
        </div>
        <div className="w-full">
          <CopyLink link={link} />
        </div>
        <div className="flex w-full gap-2">
          <a href={whatsappShareUrl(link)} target="_blank" rel="noopener noreferrer" className="kit-press flex h-12 flex-1 items-center justify-center rounded-full bg-cobalt-500 text-[15px] font-medium text-white hover:bg-cobalt-600">
            Share on WhatsApp
          </a>
          <a href={link} target="_blank" rel="noopener noreferrer" className="flex h-12 flex-1 items-center justify-center rounded-full bg-paper-deep text-[15px] font-medium text-ink hover:bg-paper-shade">
            Open the page
          </a>
        </div>
        <div className="hidden items-center gap-4 rounded-2xl bg-paper p-3 text-left sm:flex">
          <QrCode url={link} size={112} />
          <p className="text-[14px] leading-[1.45] text-ink-soft">Scan with your phone to see your products in your own room, at real size.</p>
        </div>
        <button type="button" onClick={onClose} className="text-[15px] font-medium text-ink-muted hover:text-ink">
          Back to the studio
        </button>
      </div>
    </div>
  );
}
