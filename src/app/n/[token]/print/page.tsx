import { notFound } from "next/navigation";
import { tokenAccess } from "@/lib/sharing";
import { PrintableNote } from "@/components/PrintableNote";

/* Druk z odnośnika - wolno każdemu, kto może notatkę przeczytać. */
export default async function PrintSharedNotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await tokenAccess(token);
  if (!result.ok) notFound();
  return <PrintableNote note={result.access.note} token={token} />;
}
