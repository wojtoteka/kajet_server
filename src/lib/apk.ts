/*
  Odczyt numeru wydania wprost z pliku APK.

  Numer wydania (versionCode) i nazwa wersji (versionName) były dotąd
  przepisywane ręcznie do formularza w panelu. Aplikacja porównuje SWÓJ
  versionCode z tym, co poda serwer, więc jedna pomyłka przy wpisywaniu znaczy
  albo komunikat o aktualizacji, który nie schodzi z ekranu mimo najnowszej
  wersji, albo taki, który nie pojawia się nigdy. Jedynym miejscem, które zna
  prawdę, jest sam plik - i stąd ją bierzemy.

  Bez dodatkowej biblioteki. Plik APK to zwykły zip, a Node umie rozpakować
  strumień sam (`zlib`); w środku leży AndroidManifest.xml zapisany binarnie
  (format AXML) i to jego czytamy niżej. Kilkaset linijek własnego kodu jest tu
  uczciwszą ceną niż kolejna zależność w projekcie, który ma ich dziewięć.

  Nic tu nie ufa zawartości pliku: każdy odczyt sprawdza, czy mieści się
  w buforze, a każda niezgodność kończy się wyjątkiem. Plik wgrywa wprawdzie
  tylko administrator, ale kod, który czyta cudze bajty, nie ma prawa liczyć na
  niczyją dobrą wolę.
*/

import { open } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

export type ApkVersion = {
  /** versionCode z pliku - liczba, po której aplikacja poznaje, że jest starsza. */
  versionCode: number;
  /** versionName z pliku, na przykład 26.08.02. Puste, gdy plik go nie podaje. */
  versionName: string;
};

// --- Zip ---

/** Podpisy początków struktur zipa. */
const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_ENTRY = 0x04034b50;

const MANIFEST_NAME = "AndroidManifest.xml";

/**
 * Ile bajtów od końca pliku przeszukujemy w poszukiwaniu stopki zipa.
 *
 * Stopka leży na samym końcu, chyba że plik ma komentarz - a ten mieści się
 * w 65 535 bajtach. Z zapasem na samą stopkę wychodzi 64 KB i tyle wystarczy
 * zawsze.
 */
const TAIL_BYTES = 66 * 1024;

/** Najdłuższy przyjmowany AndroidManifest.xml po rozpakowaniu. */
const LONGEST_MANIFEST = 4 * 1024 * 1024;

/**
 * Wersja z pliku APK albo `null`, gdy pliku nie da się odczytać.
 *
 * `null` NIE znaczy „plik jest zły" - znaczy tylko tyle, że tą drogą nie
 * poznamy numeru wydania. Wołający ma wtedy zostać przy tym, co wpisał
 * człowiek, zamiast odmawiać wystawienia wydania.
 */
export async function apkVersion(path: string): Promise<ApkVersion | null> {
  try {
    const manifest = await readManifest(path);
    return manifestVersion(manifest);
  } catch {
    return null;
  }
}

/** Rozpakowany AndroidManifest.xml z wnętrza pliku APK. */
async function readManifest(path: string): Promise<Buffer> {
  const file = await open(path, "r");
  try {
    const size = (await file.stat()).size;
    if (size < 22) throw new Error("za-krotki-plik");

    // Stopka zipa: mówi, gdzie zaczyna się spis zawartości.
    const tailLength = Math.min(size, TAIL_BYTES);
    const tail = Buffer.alloc(tailLength);
    await file.read(tail, 0, tailLength, size - tailLength);

    const stopka = lastIndexOfSignature(tail, END_OF_DIRECTORY);
    if (stopka < 0) throw new Error("brak-stopki-zipa");

    const directorySize = tail.readUInt32LE(stopka + 12);
    const directoryAt = tail.readUInt32LE(stopka + 16);
    if (directorySize === 0 || directoryAt + directorySize > size) {
      throw new Error("spis-poza-plikiem");
    }

    const directory = Buffer.alloc(directorySize);
    await file.read(directory, 0, directorySize, directoryAt);

    const entry = findEntry(directory, MANIFEST_NAME);
    if (!entry) throw new Error("brak-manifestu");
    if (entry.plainSize > LONGEST_MANIFEST) throw new Error("manifest-za-duzy");

    /*
      Gdzie zaczyna się treść. Nagłówek przy samych danych ma WŁASNE długości
      nazwy i pola dodatkowego - potrafią różnić się od tych ze spisu, bo to
      w polu dodatkowym leży wyrównanie do granicy pamięci. Liczenie ich ze
      spisu daje przesunięcie o kilka bajtów i rozpakowanie kończy się śmieciem.
    */
    const localHeader = Buffer.alloc(30);
    await file.read(localHeader, 0, 30, entry.at);
    if (localHeader.readUInt32LE(0) !== LOCAL_ENTRY) throw new Error("zly-naglowek");

    const contentAt =
      entry.at + 30 + localHeader.readUInt16LE(26) + localHeader.readUInt16LE(28);
    if (contentAt + entry.packedSize > size) throw new Error("tresc-poza-plikiem");

    const packed = Buffer.alloc(entry.packedSize);
    await file.read(packed, 0, entry.packedSize, contentAt);

    // 0 to plik odłożony bez pakowania, 8 to deflate. Nic innego w APK nie bywa.
    if (entry.method === 0) return packed;
    if (entry.method === 8) return inflateRawSync(packed, { maxOutputLength: LONGEST_MANIFEST });
    throw new Error("nieznane-pakowanie");
  } finally {
    await file.close();
  }
}

function lastIndexOfSignature(buffer: Buffer, signature: number): number {
  for (let at = buffer.length - 22; at >= 0; at -= 1) {
    if (buffer.readUInt32LE(at) === signature) return at;
  }
  return -1;
}

type Entry = { at: number; method: number; packedSize: number; plainSize: number };

/** Pozycja pliku o tej nazwie w spisie zawartości zipa. */
function findEntry(directory: Buffer, name: string): Entry | null {
  let at = 0;
  while (at + 46 <= directory.length) {
    if (directory.readUInt32LE(at) !== DIRECTORY_ENTRY) return null;

    const nameLength = directory.readUInt16LE(at + 28);
    const extraLength = directory.readUInt16LE(at + 30);
    const commentLength = directory.readUInt16LE(at + 32);
    const end = at + 46 + nameLength + extraLength + commentLength;
    if (end > directory.length) return null;

    if (directory.subarray(at + 46, at + 46 + nameLength).toString("latin1") === name) {
      return {
        at: directory.readUInt32LE(at + 42),
        method: directory.readUInt16LE(at + 10),
        packedSize: directory.readUInt32LE(at + 20),
        plainSize: directory.readUInt32LE(at + 24),
      };
    }

    at = end;
  }
  return null;
}

// --- Binarny AndroidManifest.xml (AXML) ---

/*
  Plik jest ciągiem kawałków, każdy z nagłówkiem: rodzaj (2 bajty), długość
  nagłówka (2), długość całości (4). Interesują nas dwa rodzaje: skład napisów
  (wszystkie teksty pliku w jednym worku) i początek znacznika - bo versionCode
  i versionName to zwykłe atrybuty znacznika <manifest>.
*/

const CHUNK_STRING_POOL = 0x0001;
const CHUNK_RESOURCE_MAP = 0x0180;
const CHUNK_START_ELEMENT = 0x0102;

/** Napisy w składzie są w UTF-8 zamiast w UTF-16, gdy zapalony jest ten bit. */
const POOL_UTF8 = 1 << 8;

const VALUE_STRING = 0x03;
const VALUE_INT_DEC = 0x10;
const VALUE_INT_HEX = 0x11;

const NOTHING = 0xffffffff;

/*
  Numery atrybutów z Androida. Nazwy atrybutów zwykle leżą w składzie napisów
  wprost („versionCode"), ale bywają puste - wtedy zostaje tylko numer z mapy
  zasobów, dołączonej do pliku właśnie na tę okoliczność.
*/
const RESOURCE_VERSION_CODE = 0x0101021b;
const RESOURCE_VERSION_NAME = 0x0101021c;

/** Wyciąga wersję z rozpakowanego AndroidManifest.xml. Rzuca, gdy plik jest inny. */
export function manifestVersion(manifest: Buffer): ApkVersion {
  let pool: string[] = [];
  let resources: number[] = [];

  let at = 8; // nagłówek całego pliku
  while (at + 8 <= manifest.length) {
    const kind = manifest.readUInt16LE(at);
    const headerLength = manifest.readUInt16LE(at + 2);
    const length = manifest.readUInt32LE(at + 4);
    if (length < 8 || at + length > manifest.length) break;

    if (kind === CHUNK_STRING_POOL) {
      pool = readPool(manifest, at, length);
    } else if (kind === CHUNK_RESOURCE_MAP) {
      resources = readResourceMap(manifest, at, headerLength, length);
    } else if (kind === CHUNK_START_ELEMENT) {
      const found = readManifestElement(manifest, at, headerLength, length, pool, resources);
      // Interesuje nas wyłącznie <manifest>, czyli pierwszy znacznik pliku.
      // Dalej idą uprawnienia i aktywności, w których tego nie ma.
      if (found) return found;
    }

    at += length;
  }

  throw new Error("brak-znacznika-manifest");
}

/** Wszystkie napisy pliku, po kolei. Atrybuty odwołują się do nich numerem. */
function readPool(buffer: Buffer, start: number, length: number): string[] {
  const count = buffer.readUInt32LE(start + 8);
  const flags = buffer.readUInt32LE(start + 16);
  const textAt = start + buffer.readUInt32LE(start + 20);
  const utf8 = (flags & POOL_UTF8) !== 0;
  const end = start + length;

  const strings: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const offsetAt = start + 28 + index * 4;
    if (offsetAt + 4 > end) break;

    const at = textAt + buffer.readUInt32LE(offsetAt);
    if (at >= end) {
      strings.push("");
      continue;
    }
    strings.push(utf8 ? readUtf8(buffer, at, end) : readUtf16(buffer, at, end));
  }
  return strings;
}

/**
 * Napis w UTF-8: długość w znakach, długość w bajtach, treść.
 *
 * Obie długości są jednobajtowe, a napis dłuższy niż 127 zapisuje je na dwóch
 * bajtach - poznać to po zapalonym najstarszym bicie pierwszego.
 */
function readUtf8(buffer: Buffer, start: number, end: number): string {
  let at = start;
  at = skipLength8(buffer, at); // długość w znakach - nieużywana
  const bytes = readLength8(buffer, at);
  at = skipLength8(buffer, at);
  if (at + bytes.value > end) return "";
  return buffer.subarray(at, at + bytes.value).toString("utf8");
}

function readLength8(buffer: Buffer, at: number): { value: number } {
  const first = buffer.readUInt8(at);
  if ((first & 0x80) === 0) return { value: first };
  return { value: ((first & 0x7f) << 8) | buffer.readUInt8(at + 1) };
}

function skipLength8(buffer: Buffer, at: number): number {
  return (buffer.readUInt8(at) & 0x80) === 0 ? at + 1 : at + 2;
}

/** Napis w UTF-16: długość w znakach, treść, zero na końcu. */
function readUtf16(buffer: Buffer, start: number, end: number): string {
  const first = buffer.readUInt16LE(start);
  let at = start + 2;
  let characters = first;
  if ((first & 0x8000) !== 0) {
    characters = ((first & 0x7fff) << 16) | buffer.readUInt16LE(at);
    at += 2;
  }
  if (at + characters * 2 > end) return "";
  return buffer.subarray(at, at + characters * 2).toString("utf16le");
}

/** Numer zasobu dla każdego napisu ze składu. Puste, gdy pliku to nie niesie. */
function readResourceMap(
  buffer: Buffer,
  start: number,
  headerLength: number,
  length: number,
): number[] {
  const ids: number[] = [];
  for (let at = start + headerLength; at + 4 <= start + length; at += 4) {
    ids.push(buffer.readUInt32LE(at));
  }
  return ids;
}

/**
 * Atrybuty znacznika, o ile to <manifest>. Dla każdego innego zwraca `null`,
 * żeby czytanie szło dalej.
 */
function readManifestElement(
  buffer: Buffer,
  start: number,
  headerLength: number,
  length: number,
  pool: string[],
  resources: number[],
): ApkVersion | null {
  const body = start + headerLength;
  if (body + 16 > start + length) return null;

  if (pool[buffer.readUInt32LE(body + 4)] !== "manifest") return null;

  const attributesAt = body + buffer.readUInt16LE(body + 8);
  const attributeLength = buffer.readUInt16LE(body + 10);
  const count = buffer.readUInt16LE(body + 12);
  if (attributeLength < 20) throw new Error("dziwne-atrybuty");

  let versionCode = 0;
  let versionName = "";

  for (let index = 0; index < count; index += 1) {
    const at = attributesAt + index * attributeLength;
    if (at + 20 > start + length) break;

    const nameIndex = buffer.readUInt32LE(at + 4);
    const raw = buffer.readUInt32LE(at + 8);
    const type = buffer.readUInt8(at + 15);
    const data = buffer.readUInt32LE(at + 16);

    const name = pool[nameIndex] ?? "";
    const resource = resources[nameIndex] ?? 0;

    if (name === "versionCode" || resource === RESOURCE_VERSION_CODE) {
      if (type === VALUE_INT_DEC || type === VALUE_INT_HEX) versionCode = data;
    } else if (name === "versionName" || resource === RESOURCE_VERSION_NAME) {
      if (type === VALUE_STRING) {
        versionName = pool[raw !== NOTHING ? raw : data] ?? "";
      } else if (type === VALUE_INT_DEC || type === VALUE_INT_HEX) {
        versionName = String(data);
      }
    }
  }

  if (versionCode <= 0) throw new Error("brak-numeru-wydania");
  return { versionCode, versionName: versionName.trim() };
}
