import { prisma } from "./prisma";
import { readAttachment } from "./files";

export async function serveAttachment(noteId: string, name: string | null): Promise<Response> {
  if (!name) return new Response("Podaj nazwę załącznika.", { status: 400 });

  const attachment = await prisma.attachment.findUnique({
    where: { noteId_name: { noteId, name } },
  });
  if (!attachment) return new Response("Nie ma takiego załącznika.", { status: 404 });

  const data = await readAttachment(attachment.path);
  if (!data) return new Response("Plik zniknął z dysku serwera.", { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": attachment.mime,
      "content-length": String(attachment.sizeBytes),
      // Content hash as a version marker: the browser does not download the
      // same photo twice.
      etag: `"${attachment.hash}"`,
      "cache-control": "private, max-age=31536000, immutable",
      // Attachments are displayed, not executed. This is a guard against a
      // file claiming to be an image while being something else.
      "content-security-policy":
        "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
      "x-content-type-options": "nosniff",
    },
  });
}
