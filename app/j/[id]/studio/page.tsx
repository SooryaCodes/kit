import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { getJobView } from "@/lib/jobs/view";
import { StudioEditor } from "./studio-editor";

export const metadata: Metadata = { title: "Studio · Kit" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const job = await getJobView(id);
  if (!job) notFound();
  if (job.status !== "ready") redirect(`/j/${id}`);
  return (
    <main className="bg-studio relative isolate min-h-svh">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <AppHeader />
      <StudioEditor job={job} />
    </main>
  );
}
