import { notFound } from "next/navigation";
import { tokenAccess } from "@/lib/sharing";
import { PrintableNote } from "@/components/PrintableNote";

/* Druk z odnośnika - wolno każdemu, kto może notatkę przeczytać. */
export default async function PrintSharedNotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ note?: string }>;
}) {
  const { token } = await params;
  const { note } = await searchParams;
  const result = await tokenAccess(token, note);
  if (!result.ok) notFound();
  return <PrintableNote note={result.access.note} token={token} />;
}
