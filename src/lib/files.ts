import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { settings } from "./settings";

function rootDirectory(): string {
  return path.resolve(process.cwd(), settings.files.directory);
}

function noteDirectory(ownerId: string, noteId: string): string {
  return path.join(rootDirectory(), safeId(ownerId), safeId(noteId));
}

function safeId(id: string): string {
  const clean = id.replace(/[^A-Za-z0-9_-]/g, "");
  if (!clean) throw new Error("Empty file identifier.");
  return clean;
}

function diskName(userName: string, hash: string): string {
  const extension = path.extname(userName).toLowerCase().replace(/[^.a-z0-9]/g, "");
  return `${hash.slice(0, 32)}${extension || ".bin"}`;
}

export function contentHash(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export type StoredFile = {
path: string;
  hash: string;
  sizeBytes: number;
};

/**
 * Odmowa zapisu z komunikatem przeznaczonym dla użytkownika. Każdy inny
 * wyjątek z zapisu (błędy dysku) niesie w treści ścieżki serwera i ma
 * zostać w dzienniku, nie w odpowiedzi.
 */
export class RefusedUpload extends Error {}

export async function storeAttachment(
  ownerId: string,
  noteId: string,
  userName: string,
  data: Buffer,
): Promise<StoredFile> {
  if (data.byteLength > settings.files.maxFileBytes) {
    throw new RefusedUpload(
      `Plik jest za duży. Największy przyjmowany rozmiar to ${Math.round(settings.files.maxFileBytes / 1024 / 1024)} MB.`,
    );
  }

  const hash = contentHash(data);
  const directory = noteDirectory(ownerId, noteId);
  await mkdir(directory, { recursive: true });

  const name = diskName(userName, hash);
  await writeFile(path.join(directory, name), data);

  return {
    path: path.posix.join(safeId(ownerId), safeId(noteId), name),
    hash,
    sizeBytes: data.byteLength,
  };
}

export async function readAttachment(relativePath: string): Promise<Buffer | null> {
  const full = path.resolve(rootDirectory(), relativePath);

  // Once joined, the path must still lie inside the files directory. Without
  // this check a database entry such as "../../etc" would let reads escape
  // the place set aside for them.
  if (!full.startsWith(rootDirectory() + path.sep)) return null;

  try {
    return await readFile(full);
  } catch {
    return null;
  }
}

export async function deleteAttachment(relativePath: string): Promise<void> {
  const full = path.resolve(rootDirectory(), relativePath);
  if (!full.startsWith(rootDirectory() + path.sep)) return;
  await rm(full, { force: true });
}

export async function deleteNoteDirectory(ownerId: string, noteId: string): Promise<void> {
  await rm(noteDirectory(ownerId, noteId), { recursive: true, force: true });
}

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/json",
]);

export function mayUpload(mime: string): boolean {
  return ALLOWED_TYPES.has(mime);
}

/** Guess a allowed MIME type from file bytes. Returns null when unknown. */
export function sniffUploadMime(data: Buffer): string | null {
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  ) {
    return "image/png";
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    data.length >= 6 &&
    data[0] === 0x47 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x38 &&
    (data[4] === 0x37 || data[4] === 0x39) &&
    data[5] === 0x61
  ) {
    return "image/gif";
  }
  if (
    data.length >= 12 &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  const head = data.subarray(0, Math.min(data.length, 256)).toString("utf8").trimStart();
  if (head.startsWith("{") || head.startsWith("[")) {
    try {
      JSON.parse(data.toString("utf8"));
      return "application/json";
    } catch {
      // Not JSON despite a suggestive start.
    }
  }
  if (
    head.startsWith("<svg") ||
    (head.startsWith("<?xml") && /<svg[\s>]/i.test(head))
  ) {
    return "image/svg+xml";
  }

  return null;
}

/**
 * Decide the MIME type for an upload. Declared `Content-Type` alone is not
 * trusted — the bytes must sniff to an allowed type. When both are present
 * and disagree, the sniffed type wins.
 */
export function resolveUploadMime(declared: string, data: Buffer): string | null {
  const sniffed = sniffUploadMime(data);
  if (!sniffed || !mayUpload(sniffed)) return null;
  if (declared && mayUpload(declared) && declared !== sniffed) {
    // Declared type is allowed but does not match the bytes — refuse rather
    // than store a misleading MIME.
    return null;
  }
  return sniffed;
}
