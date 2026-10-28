import type { Metadata } from "next";
import { AppHeader } from "@/components/app/app-header";
import { isTemplateId } from "@/lib/templates";
import { CreateFlow } from "./create-flow";

export const metadata: Metadata = { title: "Make your shop link · Kit" };

export default async function NewPage({ searchParams }: { searchParams: Promise<{ template?: string; mode?: string }> }) {
  const { template, mode } = await searchParams;
  // sellers start on the product format, creators on "what's in my bag"
  const fallback = mode === "creator" ? "bag" : "seller";
  return (
    <main className="bg-studio relative isolate min-h-svh">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <AppHeader action={false} />
      <CreateFlow initialTemplate={isTemplateId(template) ? template : fallback} />
    </main>
  );
}
