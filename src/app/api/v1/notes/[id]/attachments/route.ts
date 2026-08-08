import { error, userFromRequest, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { reserveBytes, changeUsed } from "@/lib/quota";
import {
  readAttachment,
  mayUpload,
  resolveUploadMime,
  deleteAttachment,
  storeAttachment,
  RefusedUpload,
} from "@/lib/files";

export { OPTIONS } from "@/lib/api";

export const POST = wrapApi(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const result = await userFromRequest(request);
  if ("errorResponse" in result) return result.errorResponse;
  const user = result.user;
  const { id: noteId } = await params;

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, ownerId: true },
  });
  if (!note) return error("no-note", "Nie ma takiej notatki na serwerze.", 404);
  if (note.ownerId !== user.id) {
    return error("not-yours", "Ta notatka należy do kogoś innego.", 403);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("bad-request", "Nie udało się odczytać wysyłanego pliku.", 400);
  }

  const file = form.get("file");
  const name = String(form.get("name") ?? "").trim();

  if (!(file instanceof File) || !name) {
    return error("bad-request", "Brakuje pliku albo jego nazwy.", 400);
  }
  if (!mayUpload(file.type)) {
    return error(
      "bad-type",
      "Ten rodzaj pliku nie jest przyjmowany. Wolno wysyłać zdjęcia i rysunki.",
      415,
    );
  }

  const data = Buffer.from(await file.arrayBuffer());
  const mime = resolveUploadMime(file.type, data);
  if (!mime) {
    return error(
      "bad-type",
      "Zawartość pliku nie zgadza się z zadeklarowanym rodzajem. Wolno wysyłać zdjęcia i rysunki.",
      415,
    );
  }

  const previous = await prisma.attachment.findUnique({
    where: { noteId_name: { noteId, name } },
    select: { id: true, sizeBytes: true, path: true, hash: true },
  });

  const added = data.byteLength - (previous?.sizeBytes ?? 0);
  const room = await reserveBytes(user.id, added);
  if (!room.ok) return error("out-of-space", room.reason, 507);

  let stored;
  try {
    stored = await storeAttachment(user.id, noteId, name, data);
  } catch (problem) {
    await changeUsed(user.id, -added);
    // Disk errors carry absolute server paths in the message - the client
    // only hears that the save failed, the detail stays in the log.
    console.error("[api/v1] attachment save", problem);
    return error(
      "save-failed",
      problem instanceof RefusedUpload ? problem.message : "Nie udało się zapisać pliku.",
      400,
    );
  }

  // The same file under the same name already sits on disk under a name made
  // from its hash, so we delete the old file only once the content really changed.
  if (previous && previous.hash !== stored.hash) {
    await deleteAttachment(previous.path);
  }

  try {
    await prisma.attachment.upsert({
      where: { noteId_name: { noteId, name } },
      create: {
        noteId,
        name,
        mime,
        sizeBytes: stored.sizeBytes,
        path: stored.path,
        hash: stored.hash,
      },
      update: {
        mime,
        sizeBytes: stored.sizeBytes,
        path: stored.path,
        hash: stored.hash,
      },
    });
  } catch (problem) {
    await changeUsed(user.id, -added);
    throw problem;
  }

  return json({
    name,
    hash: stored.hash,
    sizeBytes: stored.sizeBytes,
    url: `/api/v1/notes/${noteId}/attachments?name=${encodeURIComponent(name)}`,
  });
});

export const GET = wrapApi(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const result = await userFromRequest(request);
  if ("errorResponse" in result) return result.errorResponse;
  const { id: noteId } = await params;

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { ownerId: true },
  });
  if (!note) return error("no-note", "Nie ma takiej notatki na serwerze.", 404);
  if (note.ownerId !== result.user.id) {
    return error("not-yours", "Ta notatka należy do kogoś innego.", 403);
  }

  const name = new URL(request.url).searchParams.get("name");

  if (!name) {
    const attachments = await prisma.attachment.findMany({
      where: { noteId },
      select: { name: true, mime: true, sizeBytes: true, hash: true },
    });
    return json({ attachments });
  }

  const attachment = await prisma.attachment.findUnique({
    where: { noteId_name: { noteId, name } },
  });
  if (!attachment) return error("no-file", "Nie ma takiego załącznika.", 404);

  const etag = `"${attachment.hash}"`;
  const cacheControl = "private, max-age=0, must-revalidate";
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) {
    const candidates = ifNoneMatch.split(",").map((part) => part.trim());
    if (candidates.some((part) => part === etag || part === `W/${etag}`)) {
      return new Response(null, {
        status: 304,
        headers: {
          etag,
          "cache-control": cacheControl,
        },
      });
    }
  }

  const data = await readAttachment(attachment.path);
  if (!data) return error("no-file", "Plik zniknął z dysku serwera.", 404);

  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": attachment.mime,
      "content-length": String(attachment.sizeBytes),
      // Content hash as a version marker. Thanks to it the app and the browser
      // can avoid downloading the same photo twice. The URL itself has no hash,
      // so we do not mark the response immutable — clients revalidate via ETag.
      etag,
      "cache-control": cacheControl,
    },
  });
});

export const DELETE = wrapApi(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const result = await userFromRequest(request);
  if ("errorResponse" in result) return result.errorResponse;

  const { id: noteId } = await params;
  const name = new URL(request.url).searchParams.get("name");
  if (!name) return error("bad-request", "Podaj nazwę załącznika do skasowania.", 400);

  const attachment = await prisma.attachment.findUnique({
    where: { noteId_name: { noteId, name } },
    include: { note: { select: { ownerId: true } } },
  });

  if (!attachment) return new Response(null, { status: 204 });
  if (attachment.note.ownerId !== result.user.id) {
    return error("not-yours", "Ta notatka należy do kogoś innego.", 403);
  }

  await deleteAttachment(attachment.path);
  await prisma.attachment.delete({ where: { id: attachment.id } });
  await changeUsed(result.user.id, -attachment.sizeBytes);

  return new Response(null, { status: 204 });
});
