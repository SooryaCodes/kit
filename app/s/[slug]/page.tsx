// Public share page for one Reel: the video, its title, and a way to make your own.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/app/app-header";
import { getReelBySlug } from "@/lib/reels";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9]{6,16}$/;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const reel = SLUG.test(slug) ? await getReelBySlug(slug) : null;
  if (!reel) return { title: "Kit" };
  const title = `${reel.title ?? "A Reel"} · made with Kit`;
  return {
    title,
    description: "One photo, every item rebuilt in 3D, animated into a Reel.",
    openGraph: { title, images: reel.coverUrl ? [{ url: reel.coverUrl }] : [], videos: [{ url: reel.mp4Url }] },
    twitter: { card: "summary_large_image", title, images: reel.coverUrl ? [reel.coverUrl] : [] },
  };
}

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const reel = await getReelBySlug(slug);
  if (!reel) notFound();
  const settings = (reel.settings ?? {}) as { format?: string };
  const portrait = settings.format !== "1:1";

  return (
    <main className="bg-studio relative isolate min-h-svh">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <header className="mx-auto flex h-20 w-full max-w-[1320px] items-center justify-between px-5 sm:px-8">
        <Wordmark />
        <Link href="/new" className="rounded-full bg-ink px-5 py-2.5 text-[15px] font-medium text-white">
          Make your own
        </Link>
      </header>
      <section className="mx-auto flex max-w-[1320px] flex-col items-center gap-8 px-5 pb-24 pt-4 text-center sm:px-8">
        <h1 className="font-display text-title text-ink">{reel.title ?? "A Kit Reel"}</h1>
        <video
          src={reel.mp4Url}
          poster={reel.coverUrl ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          controls
          className="rounded-3xl bg-paper-deep shadow-[0_40px_80px_-40px_rgb(40_30_20/.5)]"
          style={{ width: portrait ? "min(420px, 88vw)" : "min(600px, 88vw)", aspectRatio: portrait ? "9 / 16" : "1 / 1" }}
        />
        <p className="max-w-md text-lead text-ink-muted">
          One photo, every item rebuilt in 3D. <span className="font-display text-[1.15em] italic text-ink">Made with Kit.</span>
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/new" className="rounded-full bg-cobalt-500 px-7 py-4 text-[17px] font-medium text-white transition-colors hover:bg-cobalt-600">
            Make your own Reel
          </Link>
          <a href={reel.mp4Url} download className="rounded-full px-6 py-4 text-[17px] font-medium text-ink-muted transition-colors hover:text-ink">
            Download video
          </a>
        </div>
      </section>
    </main>
  );
}
