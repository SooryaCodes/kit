import type { Metadata } from "next";
import { AppHeader } from "@/components/app/app-header";
import { ReelsList } from "./reels-list";

export const metadata: Metadata = { title: "My Reels · Kit" };

export default function ReelsPage() {
  return (
    <main className="bg-studio relative isolate min-h-svh">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <AppHeader />
      <div className="mx-auto w-full max-w-[1320px] px-5 pb-24 pt-6 sm:px-8 sm:pt-10">
        <h1 className="mb-10 text-center font-display text-title text-ink">
          My <span className="italic">Reels</span>
        </h1>
        <ReelsList />
      </div>
    </main>
  );
}
