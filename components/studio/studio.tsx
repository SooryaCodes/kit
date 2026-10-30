"use client";

// The studio for one photo. While the products are being found and built it shows those steps (the photo,
// the outlines, items lifting into 3D); once every product is ready it becomes the workspace.

import Link from "next/link";
import { useJob } from "@/app/j/[id]/use-job";
import { useEffect, useRef, useState } from "react";
import { Building, Confirm, Finding } from "./making";
import { MakingFrame } from "./making-frame";
import { Workspace } from "./workspace";

function stepOf(status: string): number {
  if (status === "awaiting_confirm") return 1;
  if (status === "reconstructing") return 2;
  if (status === "ready") return 3;
  return 1;
}

const Making = ({ step, children }: { step: number; children: React.ReactNode }) => (
  <MakingFrame step={step} wide>
    {children}
  </MakingFrame>
);

export function Studio({ id }: { id: string }) {
  const { job, error } = useJob(id);
  // when the last product finishes while the seller watches, hold on "All in 3D" for a moment before the workspace
  const watched = useRef(false);
  const [holding, setHolding] = useState(false);
  useEffect(() => {
    if (job?.status === "reconstructing") watched.current = true;
    if (job?.status === "ready" && watched.current) {
      watched.current = false;
      setHolding(true);
      const t = setTimeout(() => setHolding(false), 2200);
      return () => clearTimeout(t);
    }
  }, [job?.status]);

  if (!job) {
    return (
      <Making step={1}>
        <p className="py-32 text-lead text-ink-muted">{error ?? "Opening your studio…"}</p>
      </Making>
    );
  }
  if (job.status === "failed" || job.status === "budget_exceeded") {
    return (
      <Making step={1}>
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
  if (job.status === "ready" && !holding) return <Workspace job={job} />;
  const step = stepOf(job.status === "ready" ? "reconstructing" : job.status);
  return (
    <Making step={step}>
      {job.status === "awaiting_confirm" ? <Confirm job={job} /> : job.status === "reconstructing" || job.status === "ready" ? <Building job={job} done={job.status === "ready"} /> : <Finding job={job} />}
    </Making>
  );
}
