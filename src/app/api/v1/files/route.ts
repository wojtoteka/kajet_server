import { error, json, userFromRequest, wrapApi } from "@/lib/api";
import { apiWords } from "@/lib/language";
import { settings } from "@/lib/settings";
import {
  importLibraryFileForUser,
  libraryFileImportMessage,
} from "@/lib/library-file-import";
import { isLibraryUploadId } from "@/lib/library-file";

export { OPTIONS } from "@/lib/api";

/** Multipart headers and the optional folder id need a little room above the file itself. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/**
 * Upload a source/text file into the library.
 *
 * The file is stored as a CODE note, exactly like a recognised code file
 * synchronised by the Android app. Authentication is the usual app Bearer
 * token. Form fields: `file` (required), `folderId` (optional), `uploadId`
 * (optional UUID; strongly recommended for retry-safe mobile uploads).
 */
export const POST = wrapApi(async (request: Request) => {
  const identity = await userFromRequest(request);
  if ("errorResponse" in identity) return identity.errorResponse;
  const words = await apiWords();

  // This check happens before parsing multipart data, so an honest client
  // with an oversized body does not make the process materialise it first.
  const length = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(length) &&
    length > settings.files.maxFileBytes + MULTIPART_OVERHEAD_BYTES
  ) {
    const result = {
      ok: false as const,
      problem: "too-large" as const,
      status: 413,
    };
    return error("file-too-large", libraryFileImportMessage(words, result), 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("bad-request", words.apiUploadUnreadable, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return error("missing-file", words.actPickFileFirst, 400);
  }

  const folderId = String(form.get("folderId") ?? "").trim() || null;
  const uploadId = String(form.get("uploadId") ?? "").trim() || null;
  if (uploadId && !isLibraryUploadId(uploadId)) {
    return error("invalid-upload-id", words.apiBadRequest, 400);
  }
  const imported = await importLibraryFileForUser(identity.user.id, file, folderId, uploadId);
  if (!imported.ok) {
    const codes: Record<typeof imported.problem, string> = {
      "missing-name": "missing-name",
      "unsupported-extension": "unsupported-extension",
      "mime-mismatch": "mime-mismatch",
      "too-large": "file-too-large",
      unreadable: "unreadable-file",
      "not-utf8": "not-utf8",
      "no-folder": "no-folder",
      "idempotency-conflict": "idempotency-conflict",
      "save-failed": "save-failed",
    };
    return error(
      codes[imported.problem],
      libraryFileImportMessage(words, imported),
      imported.status,
    );
  }

  return json(
    {
      status: imported.created ? "created" : "existing",
      id: imported.noteId,
      title: imported.name,
      kind: "CODE",
      language: imported.language,
      fileSizeBytes: imported.fileSizeBytes,
      sizeBytes: imported.storedSizeBytes,
      version: imported.version,
      updatedAt: imported.updatedAt,
      url: `/note/${imported.noteId}`,
    },
    imported.created ? 201 : 200,
  );
});
