import { promisify } from "node:util";
import { brotliCompress, brotliDecompressSync, constants } from "node:zlib";

/*
  Treść notatki w bazie leży spakowana.

  Notatka odręczna to tysiące punktów zapisanych tekstem - po sześć liczb na
  każdą próbkę rysika, a rysik daje ich kilkaset na sekundę. Taki JSON kurczy
  się w brotli kilka razy, więc w kolumnie zostaje tylko tyle, ile trzeba.

  Na zewnątrz nic się nie zmienia: aplikacja (także stare wydania), strona
  i asystent dostają ten sam dokument co dawniej - rozpakowuje go klient
  Prismy (prisma.ts), więc reszta kodu nawet nie wie, że coś było spakowane.
  Skrót (hash) liczy się z dokumentu, nie z tego, co leży w bazie, żeby
  synchronizacja porównywała to samo co zawsze. Inaczej liczy się tylko
  sizeBytes: to waga w bazie, a więc i w limicie miejsca konta.

  Spakowana treść to znacznik PACKED, a za nim brotli w base64 - kolumna jest
  tekstowa (LONGTEXT), a zmiana jej typu znaczyłaby zmianę schematu bazy przy
  wdrożeniu. Dokument notatki zaczyna się od „{", a plik z kodem nie zaczyna
  się od znaku sterującego, więc zwykłej treści nie da się z nią pomylić.
*/
export const PACKED = "\u0001br:";

/** Krótszej treści nie pakujemy - nagłówek brotli i base64 zjadłyby cały zysk. */
export const PACK_FROM_BYTES = 1024;

/*
  Jakość 5: przy notatce rzędu 2 MB to ułamek sekundy w osobnym wątku, a dalsze
  stopnie dokładają ledwie kilka procent za kilka razy dłuższe pakowanie. Zapis
  na żywo pakuje notatkę przy każdej zmianie, więc szybkość tu waży.
*/
const QUALITY = 5;

const compress = promisify(brotliCompress);

/** Treść do zapisu w bazie: spakowana, gdy to się opłaca, inaczej bez zmian. */
export async function packNoteContent(content: string): Promise<string> {
  const plain = Buffer.from(content, "utf8");
  // Treść, która sama zaczyna się od znacznika, idzie spakowana zawsze -
  // zostawiona tak, jak jest, przy odczycie wzięłaby się za spakowaną.
  const looksPacked = content.startsWith(PACKED);
  if (plain.byteLength < PACK_FROM_BYTES && !looksPacked) return content;

  const packed =
    PACKED +
    (
      await compress(plain, {
        params: {
          [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
          [constants.BROTLI_PARAM_QUALITY]: QUALITY,
          [constants.BROTLI_PARAM_SIZE_HINT]: plain.byteLength,
        },
      })
    ).toString("base64");

  return packed.length < plain.byteLength || looksPacked ? packed : content;
}

/** Dokument z tego, co leży w bazie - spakowanego albo jeszcze nie. */
export function unpackNoteContent(stored: string): string {
  if (!isPacked(stored)) return stored;
  try {
    return brotliDecompressSync(Buffer.from(stored.slice(PACKED.length), "base64")).toString("utf8");
  } catch (problem) {
    // Nie powinno się zdarzyć - piszemy to wyłącznie my. Lepiej oddać to, co
    // jest, niż wywrócić całą stronę albo synchronizację.
    console.error(`[notatki] nie umiem rozpakować treści: ${(problem as Error)?.message ?? problem}`);
    return stored;
  }
}

export function isPacked(stored: string): boolean {
  return stored.startsWith(PACKED);
}
