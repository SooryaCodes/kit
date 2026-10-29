// Finding and building products now happen inside the studio.

import { redirect } from "next/navigation";

export default async function JobRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/studio/${id}`);
}
