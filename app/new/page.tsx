import type { Metadata } from "next";
import { MakingFrame } from "@/components/studio/making-frame";
import { isTemplateId } from "@/lib/templates";
import { CreateFlow } from "./create-flow";

export const metadata: Metadata = { title: "Make your shop link · Kit" };

export default async function NewPage({ searchParams }: { searchParams: Promise<{ template?: string; mode?: string }> }) {
  const { template, mode } = await searchParams;
  // sellers start on "for sale", creators on "things I recommend"
  const fallback = mode === "creator" ? "bag" : "seller";
  return (
    <MakingFrame step={0} wide>
      <CreateFlow initialTemplate={isTemplateId(template) ? template : fallback} />
    </MakingFrame>
  );
}
