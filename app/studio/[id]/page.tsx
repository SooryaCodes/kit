// Kit Studio: one workspace for one photo's products, from finding them to a published shop link.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Studio } from "@/components/studio/studio";

export const metadata: Metadata = { title: "Studio · Kit" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <Studio id={id} />;
}
