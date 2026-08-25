import { createHash } from "node:crypto";

import { prisma } from "./prisma";

/*
  Liczniki prób dla wszystkich zapór na serwerze.

  Każda zapora - logowanie (signin-limits.ts), raporty o awariach
  (crash-limits.ts), pytanie o wersję aplikacji (version-limits.ts),
  sprawdzanie captchy (captcha-limits.ts) i uruchamianie kodu (run-limits.ts) -
  liczy to samo: ile razy coś się zdarzyło w ostatnim oknie czasu. Liczy to
  jedno miejsce, bo pięć razy to samo to pięć razy okazja na inny błąd.

  Liczniki siedziały kiedyś w pamięci procesu. Restart je zerował, więc
  kwadrans przerwy po pięciu błędnych hasłach kończył się przy najbliższym
  wdrożeniu, a gdyby serwer kiedyś chodził w dwóch procesach, każdy liczyłby
  po swojemu i wszystkie granice byłyby podwójne. W bazie liczy się raz i
  przeżywa restart.

  Okno jest stałe, liczone od PIERWSZEJ próby: piąta pomyłka o 10:00 zamyka
  logowanie do 10:15, a nie do kwadransa po ostatnim kliknięciu. Dzięki temu
  ktoś, kto próbuje bez końca, nie przedłuża sobie kary w nieskończoność, a
  człowiek, który zapomniał hasła, wie, ile ma czekać.
*/

/** Najdłuższy klucz licznika. Tyle właśnie mieści kolumna w bazie. */
export const LONGEST_BUCKET = 190;

/**
 * Klucz licznika: rodzaj zapory i to, czego dotyczy.
 *
 * Klucz jest kluczem głównym w bazie, a ten mieści 190 znaków. Adres e-mail
 * może mieć 254, więc za długie skraca się i dokłada odcisk treści - dwa
 * różne długie adresy nie mogą trafić na jeden licznik, bo wtedy jeden
 * zamykałby logowanie drugiemu. Tak samo idzie wszystko spoza czystego ASCII:
 * MySQL liczy znaki, JavaScript jednostki UTF-16, a cięcie w połowie znaku
 * potrafi dać coś, czego baza nie przyjmie.
 *
 * UWAGA na to, co się tu wkłada: kolumna stoi na utf8mb4_unicode_ci, więc
 * baza nie odróżnia wielkich liter od małych. Dziś to bez znaczenia - adresy
 * e-mail idą tu już małymi literami, a identyfikatory kont (cuid) i odciski
 * są z natury małe. Cokolwiek, w czym wielkość liter ROBI różnicę, dostałoby
 * tu wspólny licznik z własnym odpowiednikiem pisanym inaczej.
 */
export function bucket(kind: string, what: string): string {
  const key = `${kind}:${what}`;
  if (key.length <= LONGEST_BUCKET && !ODD_CHARACTER.test(key)) return key;

  const mark = createHash("sha256").update(what).digest("hex").slice(0, 32);
  const head = what.replace(ODD_CHARACTERS, "").slice(0, LONGEST_BUCKET - kind.length - 34);
  return `${kind}:${head}~${mark}`;
}

/** Cokolwiek spoza zwykłych znaków do pisania - od spacji do tyldy. */
const ODD_CHARACTER = /[^\x20-\x7e]/;
const ODD_CHARACTERS = /[^\x20-\x7e]/g;

/** Stan jednego licznika: ile prób i od kiedy je liczymy. */
export type Attempt = { hits: number; startedAt: Date };

/** Odpowiedź zapory: przejście albo tyle sekund przerwy. */
export type Gate = { allowed: true } | { allowed: false; retryInSeconds: number };

/** Ile sekund zostało do końca okna. Zawsze co najmniej jedna. */
export function retryInSeconds(attempt: Attempt, windowMs: number, now = Date.now()): number {
  const left = attempt.startedAt.getTime() + windowMs - now;
  return Math.max(1, Math.ceil(left / 1000));
}

/**
 * Dolicza jedną próbę i oddaje stan licznika już po doliczeniu.
 *
 * Doliczenie idzie jednym zapytaniem: przy kluczu głównym i wpisie bez żadnych
 * powiązań Prisma układa z `upsert` jedno `INSERT ... ON DUPLICATE KEY UPDATE`,
 * więc dwa żądania naraz doliczą dwie próby, a nie jedną. Drugie zapytanie
 * idzie tylko wtedy, gdy okno się przeterminowało i trzeba zacząć od zera -
 * a to zdarza się raz na okno, nie raz na żądanie.
 */
export async function noteAttempt(bucket: string, windowMs: number): Promise<Attempt> {
  const now = new Date();
  const grown = await grow(bucket, now);
  if (!stale(grown, windowMs, now)) return grown;

  try {
    return await prisma.rateLimit.update({
      where: { bucket },
      data: { hits: 1, startedAt: now },
    });
  } catch {
    /*
      Wiersz zniknął nam spod ręki: albo zabrało go sprzątanie, albo drugie
      żądanie zdążyło zacząć okno od nowa przed nami. Jedno i drugie znaczy
      to samo co ta gałąź - licznik startuje od jednego.
    */
    return { hits: 1, startedAt: now };
  }
}

/** Doliczenie jednej próby, z założeniem wiersza, gdy licznika jeszcze nie ma. */
async function grow(bucket: string, now: Date): Promise<Attempt> {
  const write = {
    where: { bucket },
    create: { bucket, hits: 1, startedAt: now },
    update: { hits: { increment: 1 } },
  };

  try {
    return await prisma.rateLimit.upsert(write);
  } catch {
    /*
      Dwa pierwsze żądania na ten sam licznik w tej samej chwili: jedno
      założyło wiersz, drugie odbiło się od klucza głównego. Powtórka trafia
      już na gotowy wiersz i tylko go podbija. Gdy poszło o coś innego niż
      wyścig - o bazę, do której nie ma jak się dostać - powtórka przewróci
      się tak samo i błąd poleci dalej.
    */
    return prisma.rateLimit.upsert(write);
  }
}

/** Dolicza próbę na kilku licznikach naraz - jak przy logowaniu, gdzie liczy
    się osobno adres e-mail i osobno komputer, z którego przyszło zapytanie. */
export async function noteAttempts(buckets: string[], windowMs: number): Promise<Attempt[]> {
  const counted: Attempt[] = [];
  for (const bucket of buckets) counted.push(await noteAttempt(bucket, windowMs));
  return counted;
}

/** Stan liczników bez doliczania czegokolwiek - samo pytanie. Przeterminowane
    okna wypadają, więc w odpowiedzi są tylko liczniki, które jeszcze liczą. */
export async function readAttempts(
  buckets: string[],
  windowMs: number,
): Promise<Attempt[]> {
  if (buckets.length === 0) return [];
  const now = new Date();
  const rows = await prisma.rateLimit.findMany({ where: { bucket: { in: buckets } } });
  return rows.filter((row) => !stale(row, windowMs, now));
}

/** Kasuje liczniki - po udanym logowaniu, żeby własna pomyłka nic nie kosztowała. */
export async function forgetAttempts(buckets: string[]): Promise<void> {
  if (buckets.length === 0) return;
  await prisma.rateLimit.deleteMany({ where: { bucket: { in: buckets } } });
}

/**
 * Dolicza próbę i mówi, czy się zmieściła. Tego używają zapory, które liczą
 * każde zapytanie, a nie tylko nieudane.
 *
 * Zapytanie odrzucone też podbija licznik. Początek okna zostaje na miejscu,
 * więc przerwa i tak skończy się o tej samej godzinie - a licząc od razu,
 * przy doliczaniu nie trzeba niczego najpierw czytać i dwa żądania naraz nie
 * przecisną się obok siebie.
 */
export async function passes(
  bucket: string,
  most: number,
  windowMs: number,
): Promise<Gate> {
  const attempt = await noteAttempt(bucket, windowMs);
  if (attempt.hits <= most) return { allowed: true };
  return { allowed: false, retryInSeconds: retryInSeconds(attempt, windowMs) };
}

/** Czy okno tego licznika już się przeterminowało. */
function stale(attempt: Attempt, windowMs: number, now: Date): boolean {
  return now.getTime() - attempt.startedAt.getTime() >= windowMs;
}

/*
  Sprzątanie.

  Wiersz licznika jest jednorazowy: po oknie nikomu już nie służy, a zostawiony
  zajmuje miejsce - przy zaporze awarii czy wersji jest ich tyle, ile adresów,
  które kiedykolwiek zapukały. Najdłuższe okno to godzina, więc wszystko starsze
  niż dwie godziny na pewno jest do wyrzucenia.
*/

/** Najdłuższe okno, jakiego używa którakolwiek zapora. */
export const LONGEST_WINDOW_MS = 60 * 60 * 1000;

const SWEEP_EVERY_MS = 2 * 60 * 60 * 1000;

/** Wyrzuca liczniki, których okno dawno minęło. Oddaje, ile ich było. */
export async function purgeOldAttempts(): Promise<number> {
  const cutoff = new Date(Date.now() - 2 * LONGEST_WINDOW_MS);
  const gone = await prisma.rateLimit.deleteMany({ where: { startedAt: { lt: cutoff } } });
  return gone.count;
}

let sweeping = false;

/** Puszcza sprzątanie liczników na zegarze procesu - tak samo jak kosz
    (trash.ts) i konta bez śladu życia (inactive.ts). */
export function startLimitSweeper(): void {
  if (sweeping) return;
  sweeping = true;

  const run = async () => {
    try {
      const gone = await purgeOldAttempts();
      if (gone > 0) console.log(`[zapory] wyrzucono ${gone} przeterminowanych liczników`);
    } catch (problem) {
      // Sprzątanie nie ma prawa położyć serwera. Baza bywa jeszcze niegotowa
      // w pierwszych sekundach po starcie - następny przebieg będzie za dwie
      // godziny, a same liczniki działają bez sprzątania tak samo.
      console.error(
        `[zapory] sprzątanie liczników nie doszło do skutku: ${(problem as Error)?.message ?? problem}`,
      );
    }
  };

  // Minuta zapasu po starcie: najpierw niech wstanie baza i serwer.
  setTimeout(run, 60_000).unref();
  setInterval(run, SWEEP_EVERY_MS).unref();
}
