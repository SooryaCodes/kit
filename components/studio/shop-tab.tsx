"use client";

// Shop page: who the shop is and how customers order, the link to share (copy, WhatsApp, QR for the phone),
// and the page itself on a phone, exactly as customers will see it.

import { useEffect, useState } from "react";
import type { EditorPage } from "@/lib/shop/editor";
import { CopyLink, QrCode, whatsappShareUrl } from "./share";

const field = "w-full rounded-xl bg-paper px-3.5 py-2.5 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:bg-card focus:ring-2 focus:ring-cobalt-500";

/** The private link that opens this studio with edit rights on any device. Sent to the seller's own WhatsApp. */
function EditLink({ origin, jobId, token }: { origin: string; jobId: string; token: string }) {
  const link = `${origin}/studio/${jobId}#key=${token}`;
  const [copied, setCopied] = useState(false);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="edit-h">
      <div>
        <h2 id="edit-h" className="text-[16px] font-semibold text-ink">
          Your edit link
        </h2>
        <p className="mt-1 text-[14px] text-ink-muted">There&apos;s no account: this link is how you edit the shop from another phone or after clearing your browser. Keep it to yourself.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(`My Kit edit link (keep private): ${link}`)}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-paper-deep px-4 py-2 text-[14px] font-medium text-ink hover:bg-paper-shade">
          Send it to my WhatsApp
        </a>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="rounded-full bg-paper-deep px-4 py-2 text-[14px] font-medium text-ink hover:bg-paper-shade"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </section>
  );
}

export function ShopTab({
  page,
  token,
  jobId,
  previewKey,
  issues,
  onShop,
  onPublish,
  onUnpublish,
  publishing,
}: {
  page: EditorPage;
  token: string;
  jobId: string;
  previewKey: number;
  issues: string[];
  onShop: (patch: Partial<EditorPage>) => void;
  onPublish: () => void;
  onUnpublish: () => Promise<void>;
  publishing: boolean;
}) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/k/${page.slug}`;
  const setInfo = (patch: Partial<EditorPage["info"]>) => onShop({ info: { ...page.info, ...patch } });
  const preview = page.published ? `/k/${page.slug}` : `/k/${page.slug}?preview=${encodeURIComponent(token)}`;

  return (
    <div className="grid h-full overflow-y-auto lg:grid-cols-[420px_minmax(0,1fr)] lg:overflow-hidden">
      <div className="flex flex-col gap-6 px-5 py-6 lg:overflow-y-auto lg:border-r lg:border-paper-deep">
        <section className="flex flex-col gap-4" aria-labelledby="share-h">
          <h2 id="share-h" className="text-[16px] font-semibold text-ink">
            Your link
          </h2>
          {page.published ? (
            <>
              <CopyLink link={link} />
              <div className="flex flex-wrap gap-2">
                <a href={whatsappShareUrl(link)} target="_blank" rel="noopener noreferrer" className="rounded-full bg-paper-deep px-4 py-2 text-[14px] font-medium text-ink hover:bg-paper-shade">
                  Share on WhatsApp
                </a>
                <a href={`/k/${page.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-paper-deep px-4 py-2 text-[14px] font-medium text-ink hover:bg-paper-shade">
                  Open the page
                </a>
              </div>
              <div className="flex items-center gap-4 rounded-xl bg-paper p-3">
                {origin && <QrCode url={link} size={96} />}
                <p className="text-[14px] leading-[1.45] text-ink-soft">Scan with your phone to try &ldquo;See it in your room&rdquo; yourself.</p>
              </div>
              <p className="text-[14px] text-ink-muted">Put it in your Instagram bio and your WhatsApp status. Customers need nothing installed.</p>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Take this page down? The link will stop working until you publish again.")) void onUnpublish();
                }}
                className="self-start text-[14px] font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
              >
                Take the page down
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-3 rounded-xl bg-paper p-4">
              <p className="text-[15px] text-ink">Your page is a draft. Publish it to get a link customers can open.</p>
              {issues.length > 0 && (
                <ul className="flex flex-col gap-1 text-[14px] text-cobalt-700">
                  {issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={onPublish} disabled={publishing} className="kit-press self-start rounded-full bg-ink px-5 py-2.5 text-[15px] font-medium text-white disabled:opacity-60">
                {publishing ? "Publishing…" : "Publish now"}
              </button>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="shop-h">
          <h2 id="shop-h" className="text-[16px] font-semibold text-ink">
            Shop details
          </h2>
          <div className="flex gap-1 rounded-full bg-paper-deep p-1" role="radiogroup" aria-label="Page type">
            {(["shop", "creator"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={page.mode === m}
                onClick={() => onShop({ mode: m })}
                className={`flex-1 rounded-full px-3 py-2 text-[14px] font-medium transition-colors ${page.mode === m ? "bg-card text-ink" : "text-ink-muted hover:text-ink"}`}
              >
                {m === "shop" ? "I sell these" : "I recommend these"}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-soft">Instagram handle</span>
            <input value={page.handle ?? ""} onChange={(e) => onShop({ handle: e.target.value.replace(/\s/g, "").slice(0, 40) || null })} placeholder="@yourshop" className={field} />
          </label>
          {page.mode === "shop" ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-soft">WhatsApp number for orders</span>
              <input value={page.whatsapp ?? ""} onChange={(e) => onShop({ whatsapp: e.target.value.slice(0, 20) || null })} inputMode="tel" placeholder="+91 98765 43210" className={field} />
              <span className="text-[13px] text-ink-muted">With country code. Order opens WhatsApp with the product and price written.</span>
            </label>
          ) : (
            <p className="text-[14px] text-ink-muted">Add a buy link to each product on the Products tab. Followers tap Buy and go straight to it.</p>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-soft">Page address</span>
            <span className="flex items-center rounded-xl bg-paper pl-3.5 text-[15px] text-ink-muted focus-within:bg-card focus-within:ring-2 focus-within:ring-cobalt-500">
              /k/
              <input value={page.slug} onChange={(e) => onShop({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) })} className="min-w-0 flex-1 bg-transparent py-2.5 pr-3.5 text-ink outline-none" />
            </span>
          </label>
        </section>

        {page.mode === "shop" && (
          <section className="flex flex-col gap-4" aria-labelledby="order-h">
            <div>
              <h2 id="order-h" className="text-[16px] font-semibold text-ink">
                Before they order
              </h2>
              <p className="mt-1 text-[14px] text-ink-muted">The questions every buyer asks. Shown next to Order, and the assistant answers from them.</p>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-soft">About your shop</span>
              <input value={page.info.about ?? ""} onChange={(e) => setInfo({ about: e.target.value.slice(0, 140) || null })} placeholder="Handmade leather bags, stitched in Jaipur" className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-soft">City</span>
              <input value={page.info.city ?? ""} onChange={(e) => setInfo({ city: e.target.value.slice(0, 40) || null })} placeholder="Jaipur" className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-soft">Delivery</span>
              <input value={page.info.delivery ?? ""} onChange={(e) => setInfo({ delivery: e.target.value.slice(0, 80) || null })} placeholder="Across India in 3 to 5 days, ₹60" className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-soft">Returns or exchange</span>
              <input value={page.info.returns ?? ""} onChange={(e) => setInfo({ returns: e.target.value.slice(0, 80) || null })} placeholder="Exchange within 7 days if unused" className={field} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl bg-paper px-3.5 py-3">
              <span className="text-[15px] text-ink">Cash on delivery</span>
              <input type="checkbox" checked={page.info.cod} onChange={(e) => setInfo({ cod: e.target.checked })} className="size-5 accent-[var(--color-cobalt-500)]" />
            </label>
          </section>
        )}

        {origin && <EditLink origin={origin} jobId={jobId} token={token} />}
      </div>

      <section className="bg-studio relative flex min-h-[720px] items-center justify-center p-6 lg:min-h-0" aria-label="Phone preview">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative h-[min(760px,calc(100svh-120px))] w-[min(380px,100%)] overflow-hidden rounded-[44px] border-[10px] border-ink bg-paper">
          <iframe key={previewKey} src={preview} title="Your shop page on a phone" className="size-full" />
        </div>
      </section>
    </div>
  );
}
