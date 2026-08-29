import { Buffer } from "node:buffer";
import { ownerAccess } from "@/lib/sharing";
import { downloadableNote, downloadDisposition } from "@/lib/note-display";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await ownerAccess(id);
  if (!result.ok) return new Response(result.reason, { status: 404 });

  const file = downloadableNote(result.access.note);
  return new Response(file.body, {
    headers: {
      "content-type": file.contentType,
      "content-length": String(Buffer.byteLength(file.body, "utf8")),
      "content-disposition": downloadDisposition(file.fileName),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
