import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { settings } from "@/lib/settings";
import { buildCodeNoteContent } from "@/lib/code-note";
import { parseCodeNote } from "@/lib/code-note";
import { upsertCodeNoteForUser } from "@/lib/note-write";
import { humanSize } from "@/lib/quota";
import type { Words } from "@/lib/i18n";
import {
  fileTooBig,
  libraryFileEncodingRefused,
  libraryFileKindRefused,
  libraryFileMimeRefused,
} from "@/lib/i18n";
import {
  checkLibraryFileMetadata,
  decodeLibraryFile,
  type LibraryFileMetadataProblem,
} from "@/lib/library-file";

/** Minimum needed from the web File object; kept structural for unit callers. */
export type IncomingLibraryFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type LibraryFileImportFailure =
  | LibraryFileMetadataProblem
  | "unreadable"
  | "not-utf8"
  | "no-folder"
  | "idempotency-conflict"
  | "save-failed";

export type LibraryFileImportResult =
  | {
      ok: true;
      noteId: string;
      name: string;
      language: string;
      fileSizeBytes: number;
      storedSizeBytes: number;
      version: number;
      updatedAt: number;
      created: boolean;
    }
  | {
      ok: false;
      problem: LibraryFileImportFailure;
      /** Safe, already user-facing message returned by the shared quota/write path. */
      message?: string;
      status: number;
    };

/**
 * Common write path for the library form and `/api/v1/files`.
 *
 * A code file is represented in the cloud as a CODE note - the same shape
 * used by Android sync. No caller writes a path supplied by the user to disk.
 */
export async function importLibraryFileForUser(
  userId: string,
  incoming: IncomingLibraryFile,
  folderId?: string | null,
  uploadId?: string | null,
): Promise<LibraryFileImportResult> {
  const metadata = checkLibraryFileMetadata(incoming, settings.files.maxFileBytes);
  if (!metadata.ok) {
    return {
      ok: false,
      problem: metadata.problem,
      status:
        metadata.problem === "too-large"
          ? 413
          : metadata.problem === "unsupported-extension" || metadata.problem === "mime-mismatch"
            ? 415
            : 400,
    };
  }

  if (folderId) {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { ownerId: true },
    });
    // Nie zdradzamy, czy wskazany identyfikator nie istnieje, czy należy do
    // innego konta. W obu przypadkach nie jest prawidłowym miejscem zapisu.
    if (!folder || folder.ownerId !== userId) {
      return { ok: false, problem: "no-folder", status: 404 };
    }
  }

  let data: Buffer;
  try {
    data = Buffer.from(await incoming.arrayBuffer());
  } catch {
    return { ok: false, problem: "unreadable", status: 400 };
  }

  // Nie ufamy wyłącznie `File.size`; implementacja klienta mogła podać inną
  // liczbę niż liczba bajtów, które faktycznie przysłała.
  if (data.byteLength > settings.files.maxFileBytes) {
    return { ok: false, problem: "too-large", status: 413 };
  }

  const source = decodeLibraryFile(data);
  if (source == null) return { ok: false, problem: "not-utf8", status: 415 };

  const noteId = uploadId || randomUUID();

  // Powtórka tego samego logicznego uploadu po utracie odpowiedzi ma oddać
  // istniejący rekord, a nie tworzyć drugi. Inny plik pod tym samym kluczem
  // jest błędem klienta i nie może po cichu nadpisać pierwszego.
  if (uploadId) {
    const existing = await prisma.note.findUnique({
      where: { id: noteId },
      select: {
        ownerId: true,
        kind: true,
        title: true,
        content: true,
        sizeBytes: true,
        version: true,
        updatedAt: true,
        folderId: true,
        deletedAt: true,
      },
    });
    if (existing) {
      const code = existing.kind === "CODE" ? parseCodeNote(existing.content) : null;
      const same =
        existing.ownerId === userId &&
        existing.deletedAt == null &&
        existing.title === metadata.file.name &&
        existing.folderId === (folderId || null) &&
        code?.language === metadata.file.type.language &&
        code.source === source;
      if (!same) {
        return { ok: false, problem: "idempotency-conflict", status: 409 };
      }
      return {
        ok: true,
        noteId,
        name: metadata.file.name,
        language: metadata.file.type.language,
        fileSizeBytes: data.byteLength,
        storedSizeBytes: existing.sizeBytes,
        version: existing.version,
        updatedAt: existing.updatedAt.getTime(),
        created: false,
      };
    }
  }

  const content = buildCodeNoteContent({
    id: noteId,
    title: metadata.file.name,
    language: metadata.file.type.language,
    source,
  });
  const outcome = await upsertCodeNoteForUser(userId, {
    id: noteId,
    title: metadata.file.name,
    content,
    baseVersion: 0,
    folderId: folderId || null,
  });

  if (outcome.status === "error") {
    return {
      ok: false,
      problem: "save-failed",
      message: outcome.message,
      status: outcome.httpStatus,
    };
  }
  if (outcome.status === "conflict" || outcome.status === "gone") {
    // UUID jest świeży, więc taki wynik oznacza niespójność zapisu, nie błąd
    // danych człowieka. Nie wysyłamy do klienta szczegółów wewnętrznych.
    return { ok: false, problem: "save-failed", status: 500 };
  }

  return {
    ok: true,
    noteId,
    name: metadata.file.name,
    language: metadata.file.type.language,
    fileSizeBytes: data.byteLength,
    storedSizeBytes: Buffer.byteLength(content, "utf8"),
    version: outcome.version,
    updatedAt: outcome.status === "unchanged" ? Date.now() : outcome.updatedAt,
    created: true,
  };
}

/** Jedno tłumaczenie odmów dla formularza WWW i API. */
export function libraryFileImportMessage(
  words: Words,
  failure: Extract<LibraryFileImportResult, { ok: false }>,
): string {
  if (failure.message) return failure.message;
  switch (failure.problem) {
    case "missing-name":
      return words.actPickFileFirst;
    case "unsupported-extension":
      return libraryFileKindRefused(words);
    case "mime-mismatch":
      return libraryFileMimeRefused(words);
    case "too-large":
      return fileTooBig(words, humanSize(settings.files.maxFileBytes));
    case "not-utf8":
      return libraryFileEncodingRefused(words);
    case "no-folder":
      return words.actNoSuchFolder;
    case "idempotency-conflict":
      return words.apiBadRequest;
    case "unreadable":
      return words.apiUploadUnreadable;
    case "save-failed":
      return words.apiFileSaveFailed;
  }
}
