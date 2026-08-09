import { prisma } from "./prisma";
import { readAttachment } from "./files";
import { apiWords } from "./language";

export async function serveAttachment(noteId: string, name: string | null): Promise<Response> {
  if (!name) return new Response((await apiWords()).apiGiveAttachmentName, { status: 400 });

  const attachment = await prisma.attachment.findUnique({
    where: { noteId_name: { noteId, name } },
  });
  if (!attachment) return new Response((await apiWords()).apiNoSuchAttachment, { status: 404 });

  const data = await readAttachment(attachment.path);
  if (!data) return new Response((await apiWords()).apiFileGoneFromDisk, { status: 404 });

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
