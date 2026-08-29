/**
 * Pliki tekstowe, które aplikacja Android synchronizuje jako notatki CODE.
 *
 * To jest lustrzane odbicie `CodeLanguage` z aplikacji. Kolejność ma znaczenie
 * przy `.sql`: tak jak na tablecie i w dotychczasowym spisie serwera wygrywa
 * SQLite, a MySQL wybiera się ręcznie w edytorze.
 */
export type LibraryFileType = {
  language: string;
  namePl: string;
  nameEn?: string;
  extensions: readonly string[];
  /** Nietekstowe nazwy MIME, które zdarzają się dla kodu w pickerach. */
  applicationMimes?: readonly string[];
};

export const LIBRARY_FILE_TYPES: readonly LibraryFileType[] = [
  {
    language: "python",
    namePl: "Python",
    extensions: ["py"],
    applicationMimes: ["application/x-python-code"],
  },
  {
    language: "javascript",
    namePl: "JavaScript",
    extensions: ["js", "mjs"],
    applicationMimes: ["application/javascript", "application/x-javascript"],
  },
  {
    language: "typescript",
    namePl: "TypeScript",
    extensions: ["ts"],
    // Windows bywa przekonany, że `.ts` to strumień MPEG-2.
    applicationMimes: ["application/typescript", "video/mp2t"],
  },
  {
    language: "bash",
    namePl: "Shell",
    extensions: ["sh", "bash"],
    applicationMimes: ["application/x-sh"],
  },
  { language: "c", namePl: "C", extensions: ["c", "h"] },
  { language: "c++", namePl: "C++", extensions: ["cpp", "cc", "cxx", "hpp"] },
  { language: "csharp", namePl: "C#", extensions: ["cs"] },
  { language: "java", namePl: "Java", extensions: ["java"] },
  {
    language: "php",
    namePl: "PHP",
    extensions: ["php"],
    applicationMimes: ["application/x-httpd-php"],
  },
  {
    language: "ruby",
    namePl: "Ruby",
    extensions: ["rb"],
    applicationMimes: ["application/x-ruby"],
  },
  {
    language: "sqlite3",
    namePl: "SQL",
    extensions: ["sql"],
    applicationMimes: ["application/sql"],
  },
  { language: "html", namePl: "HTML", extensions: ["html", "htm"] },
  { language: "kotlin", namePl: "Kotlin", extensions: ["kt", "kts"] },
  { language: "go", namePl: "Go", extensions: ["go"] },
  { language: "rust", namePl: "Rust", extensions: ["rs"] },
  {
    language: "text",
    namePl: "Zwykły tekst",
    nameEn: "Plain text",
    extensions: ["txt", "log", "csv"],
    applicationMimes: ["application/csv", "application/vnd.ms-excel"],
  },
] as const;

export const LIBRARY_FILE_EXTENSIONS = LIBRARY_FILE_TYPES.flatMap((type) => [
  ...type.extensions,
]);

/** Wartość dla `accept` w przeglądarce. Walidacja serwera i tak jest obowiązkowa. */
export const LIBRARY_FILE_ACCEPT = LIBRARY_FILE_EXTENSIONS.map((extension) => `.${extension}`).join(
  ",",
);

const TYPE_BY_EXTENSION = new Map(
  LIBRARY_FILE_TYPES.flatMap((type) =>
    type.extensions.map((extension) => [extension, type] as const),
  ),
);

export function libraryFileType(fileName: string): LibraryFileType | null {
  const bare = fileName.trim().replace(/^.*[\\/]/, "");
  const extension = bare.includes(".") ? bare.split(".").pop()?.toLowerCase() : "";
  return extension ? (TYPE_BY_EXTENSION.get(extension) ?? null) : null;
}

export function isLibraryCodeLanguage(language: string): boolean {
  return LIBRARY_FILE_TYPES.some((type) => type.language === language);
}

/**
 * Android rozpoznaje rodzaj po rozszerzeniu, nie po MIME. Dostawcy plików
 * podają tu bardzo różne wartości, dlatego przyjmujemy dowolne `text/*`,
 * pusty typ i `application/octet-stream`, a z nietekstowych tylko znane
 * wyjątki dla danego formatu. Obraz nazwany `.py` nadal zostanie odrzucony.
 */
export function libraryFileMimeMatches(type: LibraryFileType, rawMime: string): boolean {
  const normalized = rawMime.split(";", 1)[0].trim().toLowerCase();
  if (!normalized || normalized === "application/octet-stream") return true;
  if (normalized.startsWith("text/")) return true;
  return type.applicationMimes?.includes(normalized) ?? false;
}

const FORBIDDEN_NAME = /["*/:<>?\\|]/g;
const RESERVED_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

/** Ta sama granica co `FileNames.MAX_LENGTH` w aplikacji. */
export const LIBRARY_FILE_NAME_LIMIT = 96;

/**
 * Nazwa bez ścieżki i znaków specjalnych. Rozszerzenie zostaje zachowane
 * także przy bardzo długiej nazwie, bo to po nim oba klienty wybierają język.
 */
export function safeLibraryFileName(rawName: string): string {
  const bare = rawName.trim().replace(/^.*[\\/]/, "");
  let clean = bare
    .replace(FORBIDDEN_NAME, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "_")
    .trimEnd()
    .replace(/[. ]+$/, "");

  if (clean.startsWith(".")) clean = `_${clean.slice(1)}`;

  const dot = clean.lastIndexOf(".");
  const extension = dot > 0 ? clean.slice(dot) : "";
  if (clean.length > LIBRARY_FILE_NAME_LIMIT) {
    const roomForBase = Math.max(1, LIBRARY_FILE_NAME_LIMIT - extension.length);
    const base = clean
      .slice(0, dot > 0 ? dot : clean.length)
      .slice(0, roomForBase)
      .replace(/[. ]+$/, "");
    clean = `${base}${extension.slice(0, LIBRARY_FILE_NAME_LIMIT - base.length)}`;
  }

  if (!clean) return "";
  const stem = clean.split(".", 1)[0].toUpperCase();
  if (RESERVED_NAMES.has(stem)) clean = `_${clean}`;
  return clean.slice(0, LIBRARY_FILE_NAME_LIMIT);
}

export type LibraryFileMetadataProblem =
  | "missing-name"
  | "unsupported-extension"
  | "mime-mismatch"
  | "too-large";

export type CheckedLibraryFile = {
  name: string;
  type: LibraryFileType;
};

/**
 * Identyfikator nadany przez klienta dla jednego logicznego uploadu.
 *
 * Ten sam UUID może bezpiecznie wrócić po zerwanym połączeniu; serwer używa
 * go wtedy jako identyfikatora notatki CODE i rozpoznaje powtórkę.
 */
export function isLibraryUploadId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/** Tania walidacja wykonywana przed `arrayBuffer()`. */
export function checkLibraryFileMetadata(
  file: { name: string; type: string; size: number },
  maxBytes: number,
): { ok: true; file: CheckedLibraryFile } | { ok: false; problem: LibraryFileMetadataProblem } {
  const name = safeLibraryFileName(file.name);
  if (!name) return { ok: false, problem: "missing-name" };

  const type = libraryFileType(name);
  if (!type) return { ok: false, problem: "unsupported-extension" };
  if (!libraryFileMimeMatches(type, file.type)) {
    return { ok: false, problem: "mime-mismatch" };
  }
  if (file.size < 0 || file.size > maxBytes) return { ok: false, problem: "too-large" };
  return { ok: true, file: { name, type } };
}

/**
 * Edytory Kajetu zapisują kod jako UTF-8. Walidacja fatalna nie zamienia po
 * cichu uszkodzonych bajtów w `�`; NUL dodatkowo odcina typową binarkę, która
 * przypadkiem ma dozwolone rozszerzenie.
 */
export function decodeLibraryFile(data: Uint8Array): string | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
    return text.includes("\u0000") ? null : text;
  } catch {
    return null;
  }
}
