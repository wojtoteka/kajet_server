/**
 * Porównuje pliki na dysku z tym, co o nich wie baza.
 *
 * Odpowiada na jedno pytanie: czy po skasowanych notatkach coś zostaje na
 * serwerze. Rozróżnia trzy rzeczy, bo znaczą co innego:
 *
 *   sierota  - plik albo katalog na dysku, do którego nie ma wiersza w bazie.
 *              Tego nikt już nie odczyta i nikomu nie liczy się do limitu.
 *   brak     - wiersz w bazie bez pliku na dysku. Notatka pokaże dziurę
 *              zamiast zdjęcia.
 *   kosz     - notatka skasowana, ale jeszcze do odzyskania. Jej pliki mają
 *              prawo leżeć na dysku; znikną przy opróżnieniu kosza.
 *
 * Użycie:
 *   node scripts/sprawdz-pliki.mjs            - tylko pokazuje
 *   node scripts/sprawdz-pliki.mjs --kasuj    - kasuje sieroty (kosza nie rusza)
 */

import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { prepareDatabase } from "./database.mjs";

const kasuj = process.argv.includes("--kasuj");
const prisma = new PrismaClient({ datasourceUrl: prepareDatabase() });
const root = path.resolve(process.cwd(), process.env.FILES_DIR ?? "./data/files");

function rozmiar(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const jednostki = ["kB", "MB", "GB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < jednostki.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${jednostki[index]}`;
}

function dni(from) {
  return Math.floor((Date.now() - from.getTime()) / 86_400_000);
}

/** Spis plików na dysku: klucz to ścieżka względna, taka jak w bazie. */
async function czytajDysk() {
  const pliki = new Map();
  let konta;
  try {
    konta = await readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const konto of konta) {
    if (!konto.isDirectory()) continue;
    let notatki;
    try {
      notatki = await readdir(path.join(root, konto.name), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const notatka of notatki) {
      if (!notatka.isDirectory()) continue;
      const katalog = path.join(root, konto.name, notatka.name);
      let wpisy;
      try {
        wpisy = await readdir(katalog, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const wpis of wpisy) {
        if (!wpis.isFile()) continue;
        const pelna = path.join(katalog, wpis.name);
        const info = await stat(pelna).catch(() => null);
        pliki.set(`${konto.name}/${notatka.name}/${wpis.name}`, {
          pelna,
          ownerId: konto.name,
          noteId: notatka.name,
          sizeBytes: info?.size ?? 0,
        });
      }
    }
  }
  return pliki;
}

async function main() {
  console.log(`\nPliki Kajetu — porównanie dysku z bazą\n`);
  console.log(`Katalog: ${root}`);

  const dysk = await czytajDysk();
  if (!dysk) {
    console.log("\nNie ma takiego katalogu. Ustaw FILES_DIR albo uruchom skrypt w katalogu serwera.");
    return 1;
  }

  const bajtyNaDysku = [...dysk.values()].reduce((sum, p) => sum + p.sizeBytes, 0);
  console.log(`Na dysku: ${dysk.size} plików, ${rozmiar(bajtyNaDysku)}`);

  const [uzytkownicy, notatki, zalaczniki] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    prisma.note.findMany({
      select: { id: true, ownerId: true, title: true, deletedAt: true },
    }),
    prisma.attachment.findMany({
      select: { noteId: true, name: true, path: true, sizeBytes: true },
    }),
  ]);

  // Zabezpieczenie przed pomyłką: pusta baza przy pełnym dysku znaczy raczej
  // złe DATABASE_URL niż tysiąc sierot. Wtedy nie kasujemy niczego.
  const podejrzanaBaza = uzytkownicy.length === 0 && dysk.size > 0;

  const kontaWBazie = new Set(uzytkownicy.map((u) => u.id));
  const notatkiWBazie = new Map(notatki.map((n) => [n.id, n]));
  const sciezkiWBazie = new Map(zalaczniki.map((z) => [z.path, z]));

  const bajtyWBazie = zalaczniki.reduce((sum, z) => sum + z.sizeBytes, 0);
  console.log(`W bazie:  ${zalaczniki.length} załączników, ${rozmiar(bajtyWBazie)}`);

  // --- Sieroty ---

  const poUsunietymKoncie = [];
  const poUsunietejNotatce = [];
  const bezWpisu = [];

  for (const [wzgledna, plik] of dysk) {
    if (!kontaWBazie.has(plik.ownerId)) {
      poUsunietymKoncie.push({ wzgledna, ...plik });
      continue;
    }
    if (!notatkiWBazie.has(plik.noteId)) {
      poUsunietejNotatce.push({ wzgledna, ...plik });
      continue;
    }
    if (!sciezkiWBazie.has(wzgledna)) {
      bezWpisu.push({ wzgledna, ...plik });
    }
  }

  const sieroty = [...poUsunietymKoncie, ...poUsunietejNotatce, ...bezWpisu];
  const bajtySierot = sieroty.reduce((sum, p) => sum + p.sizeBytes, 0);

  console.log(`\nSieroty (na dysku, bez wpisu w bazie): ${sieroty.length}, ${rozmiar(bajtySierot)}`);
  const grupy = [
    ["po skasowanych kontach", poUsunietymKoncie],
    ["po skasowanych notatkach", poUsunietejNotatce],
    ["bez wiersza załącznika", bezWpisu],
  ];
  for (const [nazwa, lista] of grupy) {
    if (lista.length === 0) continue;
    const bajty = lista.reduce((sum, p) => sum + p.sizeBytes, 0);
    console.log(`  ${nazwa}: ${lista.length} plików, ${rozmiar(bajty)}`);
    for (const plik of lista.slice(0, 10)) {
      console.log(`      ${plik.wzgledna} (${rozmiar(plik.sizeBytes)})`);
    }
    if (lista.length > 10) console.log(`      ...i jeszcze ${lista.length - 10}`);
  }

  // --- Braki ---

  const braki = zalaczniki.filter((z) => !dysk.has(z.path));
  console.log(`\nBraki (w bazie, bez pliku na dysku): ${braki.length}`);
  for (const brak of braki.slice(0, 10)) {
    const notatka = notatkiWBazie.get(brak.noteId);
    console.log(`      ${brak.name} — notatka „${notatka?.title ?? brak.noteId}"`);
  }
  if (braki.length > 10) console.log(`      ...i jeszcze ${braki.length - 10}`);

  // --- Kosz ---

  const wKoszu = notatki.filter((n) => n.deletedAt);
  const idWKoszu = new Set(wKoszu.map((n) => n.id));
  const zalacznikiWKoszu = zalaczniki.filter((z) => idWKoszu.has(z.noteId));
  const bajtyWKoszu = zalacznikiWKoszu.reduce((sum, z) => sum + z.sizeBytes, 0);
  const najstarsza = wKoszu.reduce(
    (oldest, n) => (!oldest || n.deletedAt < oldest ? n.deletedAt : oldest),
    null,
  );

  console.log(`\nW koszu: ${wKoszu.length} notatek, w tym załączników ${zalacznikiWKoszu.length} (${rozmiar(bajtyWKoszu)})`);
  if (najstarsza) {
    console.log(`      najstarsza leży od ${najstarsza.toISOString().slice(0, 10)} (${dni(najstarsza)} dni)`);
    console.log(`      to NIE są sieroty — znikną przy opróżnieniu kosza`);
  }

  // --- Sprzątanie ---

  if (!kasuj) {
    if (sieroty.length > 0) {
      console.log(`\nNic nie skasowano. Żeby posprzątać: node scripts/sprawdz-pliki.mjs --kasuj`);
    }
    return 0;
  }

  if (podejrzanaBaza) {
    console.log(`\nNIC NIE KASUJĘ: baza nie ma ani jednego konta, a na dysku leżą pliki.`);
    console.log(`To wygląda na złe połączenie z bazą, a nie na sieroty. Sprawdź .env.`);
    return 1;
  }

  let skasowane = 0;
  for (const plik of sieroty) {
    await rm(plik.pelna, { force: true });
    skasowane += 1;
  }

  // Puste katalogi po notatkach zostają po samym skasowaniu plików.
  let puste = 0;
  for (const konto of await readdir(root, { withFileTypes: true })) {
    if (!konto.isDirectory()) continue;
    const katalogKonta = path.join(root, konto.name);
    for (const notatka of await readdir(katalogKonta, { withFileTypes: true })) {
      if (!notatka.isDirectory()) continue;
      const katalog = path.join(katalogKonta, notatka.name);
      if ((await readdir(katalog)).length === 0) {
        await rm(katalog, { recursive: true, force: true });
        puste += 1;
      }
    }
    if ((await readdir(katalogKonta)).length === 0) {
      await rm(katalogKonta, { recursive: true, force: true });
      puste += 1;
    }
  }

  console.log(`\nSkasowano ${skasowane} plików (${rozmiar(bajtySierot)}) i ${puste} pustych katalogów.`);
  return 0;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code ?? 0);
  })
  .catch(async (problem) => {
    console.error(`\nNie udało się: ${problem?.message ?? problem}`);
    await prisma.$disconnect();
    process.exit(1);
  });
