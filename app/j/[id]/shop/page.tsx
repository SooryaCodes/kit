// The shop editor now lives in the studio.

import { redirect } from "next/navigation";

export default async function ShopEditorRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/studio/${id}`);
}
