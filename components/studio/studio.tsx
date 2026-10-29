"use client";

// The studio for one photo. While the products are being found and built it shows those steps (the photo,
// the outlines, items lifting into 3D); once every product is ready it becomes the workspace.

import Link from "next/link";
import { Build, Detect, Working } from "@/app/j/[id]/job-screen";
import { useJob } from "@/app/j/[id]/use-job";
import { Workspace } from "./workspace";

const STEPS = ["Photo", "Products", "3D", "Shop"] as const;

function stepOf(status: string): number {
  if (status === "awaiting_confirm") return 1;
  if (status === "reconstructing") return 2;
  if (status === "ready") return 3;
  return 0;
}

/** The making steps, framed like the studio: a quiet bar with where you are, the work on the paper. */
function Making({ children, step }: { children: React.ReactNode; step: number }) {
  return (
    <main className="bg-studio relative isolate min-h-svh">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <header className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 md:px-8">
        <Link href="/" className="font-display text-[30px] leading-none text-ink" aria-label="Kit, home">
          Kit
        </Link>
        <ol className="flex items-center gap-1 text-[14px] sm:gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} className={`rounded-full px-3 py-1.5 font-medium transition-colors ${i === step ? "bg-ink text-white" : i < step ? "text-ink" : "text-ink-faint"}`}>
              {s}
            </li>
          ))}
        </ol>
        <Link href="/dashboard" className="hidden text-[15px] font-medium text-ink-muted hover:text-ink sm:block">
          My shops
        </Link>
      </header>
      <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-6 text-center sm:px-6 sm:pt-10">{children}</div>
    </main>
  );
}

export function Studio({ id }: { id: string }) {
  const { job, error } = useJob(id);

  if (!job) {
    return (
      <Making step={0}>
        <p className="py-32 text-lead text-ink-muted">{error ?? "Opening your studio…"}</p>
      </Making>
    );
  }
  if (job.status === "failed" || job.status === "budget_exceeded") {
    return (
      <Making step={0}>
        <section className="flex flex-col items-center gap-6 py-16">
          <h1 className="font-display text-title">
            That didn&apos;t <span className="italic">work</span>
          </h1>
          <p className="max-w-md text-lead text-ink-muted">{job.userMessage ?? "Something went wrong while building your products."}</p>
          <Link href="/new?mode=shop" className="rounded-full bg-cobalt-500 px-7 py-4 text-[17px] font-medium text-white hover:bg-cobalt-600">
            Try another photo
          </Link>
        </section>
      </Making>
    );
  }
  if (job.status === "ready") return <Workspace job={job} />;
  const step = stepOf(job.status);
  return (
    <Making step={step}>
      {job.status === "awaiting_confirm" ? <Detect job={job} /> : job.status === "reconstructing" ? <Build job={job} /> : <Working job={job} />}
    </Making>
  );
}
