import type { Metadata } from "next";
import { AppHeader } from "@/components/app/app-header";
import { isTemplateId } from "@/lib/templates";
import { CreateFlow } from "./create-flow";

export const metadata: Metadata = { title: "Make a Reel · Kit" };

export default async function NewPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template } = await searchParams;
  return (
    <main className="bg-studio relative isolate min-h-svh">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <AppHeader action={false} />
      <CreateFlow initialTemplate={isTemplateId(template) ? template : "bag"} />
    </main>
  );
}
