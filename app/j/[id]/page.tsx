import type { Metadata } from "next";
import { AppHeader } from "@/components/app/app-header";
import { JobScreen } from "./job-screen";

export const metadata: Metadata = { title: "Your Reel · Kit" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="bg-studio relative isolate min-h-svh">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <AppHeader />
      <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-8 text-center sm:px-6 sm:pt-12">
        <JobScreen id={id} />
      </div>
    </main>
  );
}
