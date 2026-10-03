import { notFound } from "next/navigation";
import { ownerAccess } from "@/lib/sharing";
import { PrintableNote } from "@/components/PrintableNote";

export default async function PrintNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await ownerAccess(id);
  if (!access.ok) notFound();
  return <PrintableNote note={access.access.note} />;
}
