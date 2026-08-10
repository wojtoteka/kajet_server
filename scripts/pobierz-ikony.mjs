/**
 * Pobiera przycięty font ikon (Material Symbols Rounded) do repozytorium.
 *
 * Strona nie prosi Google o ikony przy każdym wejściu - font leży w repo
 * (src/app/material-symbols-rounded.woff2) i jedzie z naszego serwera razem
 * z resztą stylów. Google służy tylko jako krajalnia: ten skrypt wysyła mu
 * spis ikon z src/lib/icon-names.ts i zapisuje to, co wróci. Cały font to
 * 5,3 MB, wycinek z naszymi ikonami - około 100 KB.
 *
 * Użycie (po każdej zmianie spisu w icon-names.ts):
 *
 *   npm run ikony
 *
 * O samym spisie przypomina kompilator (typ IconName), o tym skrypcie -
 * komentarz w icon-names.ts. Bez niego nowa ikona pokaże się jako jej
 * nazwa zapisana słowem, bo w starym pliku fontu nie ma jej rysunku.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const katalog = path.dirname(fileURLToPath(import.meta.url));
const plikSpisu = path.join(katalog, "..", "src", "lib", "icon-names.ts");
const plikFontu = path.join(katalog, "..", "src", "app", "material-symbols-rounded.woff2");

// Bez nagłówka przeglądarki Google odsyła stary format TTF zamiast woff2.
const przegladarka =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";

const spis = await readFile(plikSpisu, "utf8");
const ikony = [...spis.matchAll(/^\s*"([a-z0-9_]+)",$/gm)].map((m) => m[1]);
if (ikony.length === 0) {
  console.error(`ŹLE: w ${plikSpisu} nie znalazłem ani jednej ikony.`);
  process.exit(1);
}

// Te same osie stoją w @font-face w globals.css (font-weight 100 700).
const adres =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:" +
  "opsz,wght,FILL@20..48,100..700,0..1" +
  `&icon_names=${ikony.join(",")}&display=block`;

const arkusz = await (await fetch(adres, { headers: { "user-agent": przegladarka } })).text();
const zrodlo = arkusz.match(/url\((https:\/\/[^)]+)\)/)?.[1];
if (!zrodlo) {
  console.error("ŹLE: w odpowiedzi Google nie ma adresu pliku fontu. Odpowiedź:");
  console.error(arkusz.slice(0, 500));
  process.exit(1);
}

const font = Buffer.from(await (await fetch(zrodlo, { headers: { "user-agent": przegladarka } })).arrayBuffer());
// woff2 zaczyna się od "wOF2" - wszystko inne to strona błędu, nie pismo.
if (font.length < 10_000 || font.toString("latin1", 0, 4) !== "wOF2") {
  console.error(`ŹLE: to, co wróciło (${font.length} B), nie wygląda na plik woff2.`);
  process.exit(1);
}

await writeFile(plikFontu, font);
console.log(`Zapisane: ${plikFontu}`);
console.log(`Ikon w spisie: ${ikony.length}, plik fontu: ${(font.length / 1024).toFixed(0)} KB.`);
