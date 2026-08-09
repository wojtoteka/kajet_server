/*
  Wydania aplikacji na Androida.

  Administrator wgrywa plik APK w panelu, wpisuje numer wersji i opis zmian.
  Jedno wydanie jest „aktualne" - to ono leży na stronie do pobrania i o nim
  mówi aplikacja, kiedy pyta serwer, czy nie jest przypadkiem starsza.

  Sam plik leży na dysku, w katalogu spod APP_DIR, pod nazwą zrobioną z jego
  skrótu - dokładnie tak jak załączniki notatek. Dzięki temu dwa wydania z tą
  samą zawartością zajmują miejsce raz, a baza nie puchnie od dziesiątek
  megabajtów.

  Plik przyjmujemy strumieniem, bez wczytywania całości do pamięci: kilkadziesiąt
  megabajtów naraz to na małym serwerze zauważalny skok, a APK zawsze jest duży.
*/

import { createHash, randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { prisma } from "./prisma";
import { humanSize } from "./quota";
import { settings } from "./settings";
import { apiWords } from "./language";
import { releaseTooBig } from "./i18n";

/** Plik APK to spakowany katalog, więc zaczyna się tak jak każdy zip. */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** Ile czasu ma administrator na opisanie wgranego pliku, zanim go sprzątniemy. */
const UNCLAIMED_HOURS = 6;

export function releasesDirectory(): string {
  return path.resolve(process.cwd(), settings.app.directory);
}

/** Ścieżka pliku wydania. Nazwa bierze się ze skrótu, więc nie da się jej podstawić. */
export function releasePath(hash: string): string {
  // Ten rzut jest zabezpieczeniem kodu, nie zdaniem do przeczytania - nazwa
  // pliku bierze się ze skrótu i nikt jej z zewnątrz nie podaje.
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error("bad-release-hash");
  return path.join(releasesDirectory(), `${hash}.apk`);
}

export type UploadOutcome =
  | { ok: true; hash: string; sizeBytes: number }
  | { ok: false; reason: string };

/**
 * Przyjmuje wysyłany plik i odkłada go na dysk pod nazwą ze skrótu. Zwraca
 * skrót, którym potem opisuje się wydanie w formularzu.
 */
export async function receiveUpload(body: ReadableStream<Uint8Array>): Promise<UploadOutcome> {
  await mkdir(releasesDirectory(), { recursive: true });

  // Piszemy najpierw pod nazwą tymczasową: skrót znamy dopiero na końcu, a
  // przerwane wysyłanie nie ma prawa zostawić po sobie ułomka udającego wydanie.
  const temporary = path.join(releasesDirectory(), `upload-${randomBytes(8).toString("hex")}.part`);

  const digest = createHash("sha256");
  let size = 0;
  let head = Buffer.alloc(0);
  const words = await apiWords();
  let refusal = "";

  const meter = new Transform({
    transform(chunk, _encoding, done) {
      const data = Buffer.from(chunk);

      size += data.byteLength;
      if (size > settings.app.maxBytes) {
        refusal = releaseTooBig(words, humanSize(settings.app.maxBytes));
        done(new Error("too-big"));
        return;
      }

      // Pierwsze cztery bajty muszą być zipem. Bez tego da się wgrać cokolwiek
      // i podać ludziom do zainstalowania.
      if (head.byteLength < ZIP_MAGIC.byteLength) {
        head = Buffer.concat([head, data.subarray(0, ZIP_MAGIC.byteLength - head.byteLength)]);
        if (head.byteLength === ZIP_MAGIC.byteLength && !head.equals(ZIP_MAGIC)) {
          refusal = words.apiNotAnApk;
          done(new Error("not-apk"));
          return;
        }
      }

      digest.update(data);
      done(null, data);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(body as NodeReadableStream<Uint8Array>),
      meter,
      createWriteStream(temporary),
    );
  } catch {
    await rm(temporary, { force: true });
    return { ok: false, reason: refusal || words.apiUploadFailed };
  }

  if (size < ZIP_MAGIC.byteLength) {
    await rm(temporary, { force: true });
    return { ok: false, reason: "Plik jest pusty." };
  }

  const hash = digest.digest("hex");
  await rename(temporary, releasePath(hash));
  return { ok: true, hash, sizeBytes: size };
}

/** Rozmiar wgranego pliku albo nic, gdy plik zniknął z dysku. */
export async function uploadedFile(hash: string): Promise<{ sizeBytes: number } | null> {
  if (!/^[0-9a-f]{64}$/.test(hash)) return null;
  try {
    const info = await stat(releasePath(hash));
    return { sizeBytes: info.size };
  } catch {
    return null;
  }
}

/**
 * Kasuje plik wydania, ale tylko wtedy, gdy nie trzyma go już żadne inne.
 * Dwa wydania o tej samej zawartości mają jeden plik na dysku.
 */
export async function forgetFile(hash: string): Promise<void> {
  const stillUsed = await prisma.appRelease.count({ where: { hash } });
  if (stillUsed > 0) return;
  await rm(releasePath(hash), { force: true });
}

/**
 * Sprząta pliki, których nie trzyma żadne wydanie: przerwane wysyłanie albo
 * plik wgrany i nieopisany. Świeże zostawiamy, bo administrator może właśnie
 * wypełniać formularz.
 */
export async function sweepUnused(): Promise<void> {
  let names: string[];
  try {
    names = await readdir(releasesDirectory());
  } catch {
    return;
  }

  const releases = await prisma.appRelease.findMany({ select: { hash: true } });
  const kept = new Set(releases.map((release) => `${release.hash}.apk`));
  const cutoff = Date.now() - UNCLAIMED_HOURS * 3_600_000;

  for (const name of names) {
    if (kept.has(name)) continue;
    const full = path.join(releasesDirectory(), name);
    try {
      const info = await stat(full);
      if (info.mtimeMs > cutoff) continue;
      await rm(full, { force: true });
    } catch {
      // Ktoś sprzątnął go przed nami. Nic się nie stało.
    }
  }
}

export function currentRelease() {
  return prisma.appRelease.findFirst({
    where: { current: true },
    orderBy: { versionCode: "desc" },
  });
}

/**
 * Nazwa, pod którą plik zapisze się u pobierającego. Cudzysłów, średnik i inne
 * takie znaki nie mają czego szukać w nagłówku Content-Disposition.
 */
export function downloadName(release: { fileName: string; version: string }): string {
  const clean = release.fileName.replace(/[^A-Za-z0-9._-]/g, "-").replace(/^-+/, "");
  if (clean && clean.toLowerCase().endsWith(".apk")) return clean;
  return `kajet-${release.version.replace(/[^A-Za-z0-9._-]/g, "-")}.apk`;
}
