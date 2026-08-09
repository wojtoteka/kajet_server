/*
  Wydanie aplikacji do pobrania.

  Bez „release” w adresie idzie to, co administrator wystawił jako aktualne -
  i taki właśnie odnośnik dostaje aplikacja przy sprawdzaniu aktualizacji.

  Plik czytamy strumieniem, kawałek po kawałku. Kilkadziesiąt megabajtów razy
  kilka osób naraz wczytane do pamięci potrafi położyć niewielki serwer.
*/

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { currentRelease, downloadName, releasePath } from "@/lib/app-release";
import { apiWords } from "@/lib/language";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("release");

  const release = id
    ? await prisma.appRelease.findUnique({ where: { id } })
    : await currentRelease();

  if (!release) {
    return new Response(
      (await apiWords()).actNoReleaseForDownload,
      { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const file = releasePath(release.hash);
  let sizeBytes: number;
  try {
    sizeBytes = (await stat(file)).size;
  } catch {
    return new Response((await apiWords()).actReleaseFileGone, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Ta sama zawartość zawsze pod tym samym skrótem, więc przeglądarka i
  // menedżer pobierania nie ciągną drugi raz tego samego pliku.
  const etag = `"${release.hash}"`;
  const ifNoneMatch = request.headers.get("if-none-match");
  if (
    ifNoneMatch &&
    ifNoneMatch
      .split(",")
      .map((part) => part.trim())
      .some((part) => part === etag || part === `W/${etag}`)
  ) {
    return new Response(null, { status: 304, headers: { etag } });
  }

  // Licznik jest tylko dla administratora, więc nieudane pobranie nie ma prawa
  // przerwać wysyłania pliku.
  prisma.appRelease
    .update({ where: { id: release.id }, data: { downloads: { increment: 1 } } })
    .catch(() => {});

  const name = downloadName(release);
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;

  return new Response(stream, {
    headers: {
      "content-type": "application/vnd.android.package-archive",
      // Długość bierzemy z dysku, nie z bazy: rozjazd tych dwóch liczb urywa
      // pobieranie w połowie i nikt nie wie dlaczego.
      "content-length": String(sizeBytes),
      "content-disposition": `attachment; filename="${name}"`,
      etag,
      "cache-control": "public, max-age=0, must-revalidate",
      "x-content-type-options": "nosniff",
    },
  });
}
