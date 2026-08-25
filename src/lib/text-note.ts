import { readDocument, type NoteDocument } from "./document";

/*
  Whole-note appearance of a TEXT note - the same fields the tablet stores in
  content.json (TextContent in the app). fontSize 0 means the default size,
  textColor is an Android ARGB int (0 = default colour).
*/
export type TextAppearance = {
  font: string;
  fontSize: number;
  textColor: number;
  align: string;
};

export const TEXT_FONTS = [
  { id: "body", label: "Tekstowy", labelEn: "Body" },
  { id: "heading", label: "Nagłówkowy", labelEn: "Display" },
  { id: "mono", label: "Maszynowy", labelEn: "Typewriter" },
] as const;

export const TEXT_DEFAULT_SIZE = 17;
export const TEXT_SMALLEST_SIZE = 10;
export const TEXT_LARGEST_SIZE = 48;

/**
 * Size to write into content.json. Zero stays the theme default - the same
 * rule as TextContent.storedFontSize on the tablet. A chosen size is 10-48.
 */
export function storedFontSize(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0;
  return Math.min(TEXT_LARGEST_SIZE, Math.max(TEXT_SMALLEST_SIZE, Math.round(points)));
}

/**
 * Size after the visible control reports `picked`. While stored is 0 the
 * field shows TEXT_DEFAULT_SIZE as a preview; echoing that 17 must not
 * persist, or a tap on the control freezes the note at 17 after sync.
 * Choosing any other 10-48 (or 17 once the stored size is already a pick)
 * writes a real size. 0 goes back to the theme default.
 */
export function persistFontSize(stored: number, picked: number): number {
  if (!Number.isFinite(picked)) return stored;
  if (stored <= 0 && Math.round(picked) === TEXT_DEFAULT_SIZE) return 0;
  return storedFontSize(picked);
}

/** Build content.json for a TEXT note in the shape the tablet expects. */
export function buildTextNoteContent(options: {
  id: string;
  title: string;
  markdown: string;
  appearance?: Partial<TextAppearance>;
  existing?: NoteDocument | null;
}): string {
  const now = Date.now();
  const existing = options.existing;

  return JSON.stringify({
    format: existing?.format ?? 1,
    id: options.id,
    kind: "text",
    title: options.title,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    tags: existing?.tags ?? [],
    favorite: existing?.favorite ?? false,
    text: {
      markdown: options.markdown,
      drawings: existing?.text?.drawings ?? [],
      font: options.appearance?.font ?? existing?.text?.font ?? "body",
      fontSize: options.appearance?.fontSize ?? existing?.text?.fontSize ?? 0,
      textColor: options.appearance?.textColor ?? existing?.text?.textColor ?? 0,
      align: options.appearance?.align ?? existing?.text?.align ?? "left",
    },
  });
}

export function textMarkdownFromContent(content: string): string {
  const document = readDocument(content);
  return document?.text?.markdown ?? "";
}

export function textAppearanceFromContent(content: string): TextAppearance {
  const document = readDocument(content);
  return {
    font: document?.text?.font ?? "body",
    fontSize: document?.text?.fontSize ?? 0,
    textColor: document?.text?.textColor ?? 0,
    align: document?.text?.align ?? "left",
  };
}

export function parseExistingTextDocument(content: string): NoteDocument | null {
  return readDocument(content);
}

/*
  Widok blokowy treści - tak jak w aplikacji (TextEditor.kt): zdjęcia widać
  jako zdjęcia, a nie jako zapis `![...](...)`. Sama notatka dalej jest jednym
  markdownem; bloki to tylko sposób pokazania go w polu do pisania.
*/
export type TextBlock =
  | { kind: "text"; text: string }
  | {
      kind: "image";
      alt: string;
      target: string;
      width: number;
      /** Ułożenie CAŁEGO wiersza ze zdjęciami: lewo, środek albo prawo. */
      align: ImageAlign;
      /** Czy zdjęcie stoi obok poprzedniego, w tym samym wierszu pliku. */
      beside: boolean;
    };

/*
  Jedno zdjęcie z wiersza. Adres łapiemy zachłannie do ostatniego nawiasu tego
  kawałka, tak samo jak podgląd, bo nazwy plików potrafią same mieć nawiasy:
  „zdjecie (2).png". Tytuł w cudzysłowie odcinamy dopiero potem, żeby nawias
  w nazwie pliku nie uciął adresu.
*/
const IMAGE_TOKEN = /^!\[([^\]]*)\]\((.+)\)$/;

/*
  Rozmiar zdjęcia w treści. Markdown sam z siebie nie ma na to miejsca, więc
  kanoniczny zapis to dopisek w opisie: `![zdjęcie|60%](assets/kot.gif)`.
  Tablet kiedyś pisał szerokość w tytule: `![zdjęcie](assets/kot.gif "60%")`.
  Oba odczyty muszą dać to samo, a zapis zawsze wraca do postaci z kreską -
  inaczej synchronizacja gubi rozmiar: opis|60% lądował na tablecie jako sam
  tekst, a zdjęcie rosło na całą szerokość.

  Z pliku czytamy, co stoi (także 10% ze starego suwaka w aplikacji). Przy
  zapisie ściągamy do 20-100%, bo taki próg ma strona i nowy suwak.
*/
const ALT_WIDTH = /^(.*?)\s*\|\s*(\d{1,3})\s*%$/;
const TITLE_WIDTH = /^(\d{1,3})%$/;

export const IMAGE_FULL_WIDTH = 100;
export const IMAGE_SMALLEST_WIDTH = 20;
/** O tyle procent zmienia się zdjęcie od jednego kliknięcia. */
export const IMAGE_WIDTH_STEP = 10;

/** Procent z pliku: bez dolnego progu, tylko 400% ścinamy do 100. */
function percentFromFile(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return IMAGE_FULL_WIDTH;
  return Math.min(IMAGE_FULL_WIDTH, Math.max(1, Math.round(n)));
}

/**
 * Rozbija środek `](…)` na adres i opcjonalny tytuł w cudzysłowie.
 * Tytuł to stary zapis szerokości z tabletu.
 */
export function readImageDestination(inside: string): { target: string; title: string } {
  const titled = /^(.*)\s+"([^"]*)"\s*$/.exec(inside);
  if (titled) return { target: titled[1].trim(), title: titled[2] };
  return { target: inside.trim(), title: "" };
}

/**
 * Czyta opis zdjęcia: sam opis i szerokość (100 = na całą szerokość).
 * Drugi argument to tytuł z `](adres "60%")` - gdy w opisie nie ma kreski.
 */
export function readImageAlt(raw: string, title = ""): { alt: string; width: number } {
  const fromAlt = raw.match(ALT_WIDTH);
  if (fromAlt) return { alt: fromAlt[1], width: percentFromFile(fromAlt[2]) };
  const fromTitle = TITLE_WIDTH.exec(title.trim());
  if (fromTitle) return { alt: raw, width: percentFromFile(fromTitle[1]) };
  return { alt: raw, width: IMAGE_FULL_WIDTH };
}

/** Składa opis z powrotem. Zdjęcie na całą szerokość nie potrzebuje dopisku. */
export function writeImageAlt(alt: string, width: number): string {
  const clean = readImageAlt(alt).alt;
  const clamped = clampImageWidth(width);
  return clamped >= IMAGE_FULL_WIDTH ? clean : `${clean}|${clamped}%`;
}

export function clampImageWidth(width: number): number {
  if (!Number.isFinite(width)) return IMAGE_FULL_WIDTH;
  return Math.min(IMAGE_FULL_WIDTH, Math.max(IMAGE_SMALLEST_WIDTH, Math.round(width)));
}

/* ------------------------------------------------------------------ */
/* Wiersz ze zdjęciami                                                  */
/* ------------------------------------------------------------------ */

/*
  Zdjęcia stojące w JEDNYM wierszu treści stoją obok siebie także na kartce:

      ![mapa|25%](assets/mapa.png) ![szkic|25%](assets/szkic.png)

  Tak samo czyta to markdown i tak samo pokazuje to aplikacja
  (core/model/ImageLines.kt) - zapis nie jest niczym naszym własnym. Wcześniej
  każde zdjęcie musiało stać w swoim wierszu i przy 25% szerokości zostawał
  po nim pusty pas przez trzy czwarte notatki.

  Ułożenie wiersza siedzi w tytule zdjęcia (`"srodek"`), a nie w opisie: opis
  czyta czytnik ekranu i trafia do wydruku, więc słowo „srodek" nie jest
  opisem zdjęcia. Ułożenie ma CAŁY wiersz, więc wszystkie zdjęcia stojące
  obok siebie dostają je takie samo.
*/

export type ImageAlign = "left" | "center" | "right";

/** Jedno zdjęcie z wiersza - opis, adres, szerokość i ułożenie wiersza. */
export type ImageOnLine = {
  alt: string;
  target: string;
  width: number;
  align: ImageAlign;
};

const CENTRE_MARK = "srodek";
const RIGHT_MARK = "prawo";

/** Ułożenie z tytułu zdjęcia. Po angielsku też - notatka bywa spoza tabletu. */
export function readImageAlign(title: string): ImageAlign {
  switch (title.trim().toLowerCase()) {
    case CENTRE_MARK:
    case "środek":
    case "center":
    case "centre":
      return "center";
    case RIGHT_MARK:
    case "right":
      return "right";
    default:
      return "left";
  }
}

/** Tytuł do zapisu - z odstępem z przodu, bo wchodzi tuż za adres. */
function imageAlignTitle(align: ImageAlign): string {
  if (align === "center") return ` "${CENTRE_MARK}"`;
  if (align === "right") return ` "${RIGHT_MARK}"`;
  return "";
}

/** Jedno zdjęcie w kanonicznym zapisie. */
export function writeImage(photo: ImageOnLine): string {
  return `![${writeImageAlt(photo.alt, photo.width)}](${photo.target}${imageAlignTitle(photo.align)})`;
}

/** Cały wiersz: zdjęcia stojące obok siebie dzieli sam odstęp. */
export function writeImageLine(photos: ImageOnLine[]): string {
  return photos.map(writeImage).join(" ");
}

/**
 * Zdjęcia z wiersza albo null, gdy w wierszu stoi cokolwiek poza nimi.
 *
 * Null znaczy „to nie jest wiersz ze zdjęciami" - wtedy wiersz zostaje
 * zwykłym tekstem, także wtedy, gdy zdjęcie stoi w środku zdania.
 */
export function readImageLine(line: string): ImageOnLine[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("![")) return null;

  const starts: number[] = [];
  for (let at = trimmed.indexOf("!["); at >= 0; at = trimmed.indexOf("![", at + 2)) {
    starts.push(at);
  }

  const photos: ImageOnLine[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const stop = index + 1 < starts.length ? starts[index + 1] : trimmed.length;
    const piece = trimmed.slice(starts[index], stop);
    // Domykający nawias tego zdjęcia to ostatni nawias przed następnym
    // zdjęciem. Między zdjęciami może stać tylko odstęp - inaczej jest to
    // zdanie ze zdjęciem w środku, a nie wiersz ze zdjęciami.
    const close = piece.lastIndexOf(")");
    if (close < 0) return null;
    if (piece.slice(close + 1).trim() !== "") return null;

    const match = IMAGE_TOKEN.exec(piece.slice(0, close + 1));
    if (!match) return null;
    const dest = readImageDestination(match[2]);
    const { alt, width } = readImageAlt(match[1], dest.title);
    photos.push({ alt, target: dest.target, width, align: readImageAlign(dest.title) });
  }
  if (photos.length === 0) return null;

  // Ułożenie ma cały wiersz, nie pojedyncze zdjęcie. Gdyby drugie zdjęcie
  // miało własne, wiersz nie miałby dokąd się przesunąć.
  const align = photos[0].align;
  return photos.map((photo) => (photo.align === align ? photo : { ...photo, align }));
}

/**
 * Szerokości zdjęć w wierszu, ściągnięte tak, żeby zmieściły się obok siebie.
 * `gapShare` to ułamek szerokości notatki zjadany przez odstępy między
 * zdjęciami. Bez tego dwa zdjęcia po 75% wychodziłyby poza kartkę, a suwak
 * od szerokości nic o sąsiedzie nie wie i wiedzieć nie musi.
 */
export function sideBySideWidths(widths: number[], gapShare = 0): number[] {
  if (widths.length === 0) return widths;
  const room = Math.max(1, IMAGE_FULL_WIDTH - gapShare);
  const together = widths.reduce((sum, width) => sum + width, 0);
  const shrink = together > room ? room / together : 1;
  return widths.map((width) => Math.min(IMAGE_FULL_WIDTH, Math.max(1, width * shrink)));
}

/**
 * Dzieli treść na bloki do pisania i bloki ze zdjęciem. Przy każdym zdjęciu -
 * przed nim i po nim - zostaje blok tekstu, nawet pusty: inaczej w notatce
 * złożonej z samych zdjęć nie byłoby gdzie kliknąć, żeby dopisać zdanie.
 */
export function splitTextBlocks(markdown: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let lines: string[] | null = null;

  const closeText = () => {
    blocks.push({ kind: "text", text: lines ? lines.join("\n") : "" });
    lines = null;
  };

  for (const line of markdown.split("\n")) {
    const photos = readImageLine(line);
    if (!photos) {
      (lines ??= []).push(line);
      continue;
    }
    closeText();
    // Kilka zdjęć w jednym wierszu treści to kilka zdjęć stojących obok
    // siebie. Każde ma swój blok - własną szerokość, podpis i przyciski -
    // a trzyma je razem znacznik `beside`.
    photos.forEach((photo, index) => {
      blocks.push({
        kind: "image",
        alt: photo.alt,
        target: photo.target,
        width: photo.width,
        align: photo.align,
        beside: index > 0,
      });
    });
  }
  closeText();
  return blocks;
}

/**
 * Numery bloków pogrupowane tak, jak stoją na kartce: zdjęcia obok siebie
 * w jednej grupie, każdy inny blok sam. Numery, a nie same bloki, bo pole do
 * pisania trzyma się numeru bloku - po nim wie, gdzie stoi kursor.
 */
export function textBlockRows(blocks: TextBlock[]): number[][] {
  const rows: number[][] = [];
  blocks.forEach((block, index) => {
    const last = rows[rows.length - 1];
    const previous = last ? blocks[last[last.length - 1]] : undefined;
    if (block.kind === "image" && block.beside && previous?.kind === "image") {
      last.push(index);
    } else {
      rows.push([index]);
    }
  });
  return rows;
}

/* ------------------------------------------------------------------ */
/* Przesuwanie zdjęcia                                                  */
/* ------------------------------------------------------------------ */

/** Notatka po przesunięciu zdjęcia i nowe miejsce tego zdjęcia. */
export type PhotoMove = { blocks: TextBlock[]; index: number };

/** Kierunek, w którym zdjęcie idzie od jednego przesunięcia. */
export type PhotoNudge = "left" | "right" | "up" | "down";

/** Czy to sam kawałek do pisania, bez ani jednego znaku. */
function isSpacer(block: TextBlock | undefined): boolean {
  return block?.kind === "text" && block.text === "";
}

/**
 * Zdjęcie stojące nad tym - albo -1, gdy nad nim zdjęcia nie ma.
 *
 * Przy każdym zdjęciu zostaje kawałek do pisania, także pusty (jest w nim
 * gdzie kliknąć, żeby dopisać zdanie), więc dwa zdjęcia jedno pod drugim mają
 * między sobą pusty blok. Dla układania wiersza on się nie liczy.
 */
function photoAbove(blocks: TextBlock[], index: number): number {
  if (blocks[index]?.kind !== "image") return -1;
  let at = index - 1;
  while (at >= 0 && isSpacer(blocks[at])) at -= 1;
  return blocks[at]?.kind === "image" ? at : -1;
}

/** Czy zdjęcie ma nad sobą inne zdjęcie, obok którego może stanąć. */
export function canStandBeside(blocks: TextBlock[], index: number): boolean {
  return photoAbove(blocks, index) >= 0;
}

/** Czy zdjęcie stoi w wierszu z innymi - czyli czy ma z czego zejść. */
export function standsInRow(blocks: TextBlock[], index: number): boolean {
  const block = blocks[index];
  if (block?.kind !== "image") return false;
  if (block.beside) return true;
  const next = blocks[index + 1];
  return next?.kind === "image" && next.beside;
}

/**
 * Stawia zdjęcie obok poprzedniego albo odsuwa je do własnego wiersza.
 *
 * Przy dołączeniu zdjęcie bierze ułożenie wiersza, do którego wchodzi -
 * ułożenie ma cały wiersz, a nie pojedyncze zdjęcie - i przeprowadza się tuż
 * za sąsiada. Puste kawałki do pisania stojące między nimi przepadają: w tym
 * samym wierszu nie ma dla nich miejsca.
 *
 * Zdjęcie stojące obok poprzedniego po prostu z wiersza wychodzi. Kiedy to ono
 * wiersz ZACZYNA, z wiersza schodzi to, co stoi za nim - inaczej pierwszego
 * zdjęcia nie dałoby się odsunąć od reszty, bo znacznik „stoję obok" ma
 * sąsiad, a nie ono.
 */
export function setPhotoBeside(
  blocks: TextBlock[],
  index: number,
  beside: boolean,
): PhotoMove {
  const block = blocks[index];
  const stay = { blocks, index };
  if (block?.kind !== "image") return stay;

  if (beside) {
    const above = photoAbove(blocks, index);
    if (above < 0) return stay;
    const before = blocks[above];
    if (before.kind !== "image") return stay;
    // Między zdjęciami stoją już tylko puste kawałki do pisania - photoAbove
    // przeszedł przez nie po drodze.
    const moved = blocks.filter((_, at) => at <= above || at >= index);
    return {
      blocks: moved.map((other, at) =>
        at === above + 1 && other.kind === "image"
          ? { ...other, beside: true, align: before.align }
          : other,
      ),
      index: above + 1,
    };
  }

  const leaving = block.beside ? index : index + 1;
  const target = blocks[leaving];
  if (target?.kind !== "image" || !target.beside) return stay;
  return {
    blocks: blocks.map((other, at) =>
      at === leaving && other.kind === "image" ? { ...other, beside: false } : other,
    ),
    index,
  };
}

/**
 * Numer wiersza dla każdego bloku - po samym bloku, nie po jego miejscu
 * w spisie. Po przesunięciu zdjęcia znacznik „stoję obok poprzedniego"
 * przestaje pasować do nowego sąsiedztwa: pierwsze zdjęcie wiersza mogło
 * wyjechać wyżej, a to, co po nim zostało, wisiałoby przy akapicie. Numery
 * zdjęte PRZED zmianą mówią, co naprawdę stało razem.
 */
function rowNumbers(blocks: TextBlock[]): Map<TextBlock, number> {
  const numbers = new Map<TextBlock, number>();
  let row = 0;
  blocks.forEach((block, index) => {
    const together =
      block.kind === "image" && block.beside && blocks[index - 1]?.kind === "image";
    if (!together) row += 1;
    numbers.set(block, row);
  });
  return numbers;
}

/** Znaczniki wiersza dopasowane do nowego sąsiedztwa. */
function tidyRows(blocks: TextBlock[], rows: Map<TextBlock, number>): TextBlock[] {
  return blocks.map((block, index) => {
    if (block.kind !== "image") return block;
    const before = blocks[index - 1];
    const together = before?.kind === "image" && rows.get(before) === rows.get(block);
    return block.beside === together ? block : { ...block, beside: together };
  });
}

/**
 * Zdjęcie o jeden blok wyżej albo niżej, ze znacznikami wiersza po ruchu.
 * Puste kawałki do pisania zdjęcie przeskakuje: samo przejście nad pustym
 * blokiem nic by w treści notatki nie zmieniło, więc ruch wyglądałby na
 * nieudany.
 */
function movePhoto(blocks: TextBlock[], from: number, up: boolean): PhotoMove {
  const step = up ? -1 : 1;
  let to = from + step;
  while (to >= 0 && to < blocks.length && isSpacer(blocks[to])) to += step;
  if (to < 0 || to >= blocks.length) return { blocks, index: from };

  const rows = rowNumbers(blocks);
  const moved = blocks.slice();
  const [taken] = moved.splice(from, 1);
  moved.splice(to, 0, taken);
  return { blocks: tidyRows(moved, rows), index: to };
}

/**
 * Zdjęcie przesunięte o jedno miejsce w podanym kierunku - myszą, strzałką
 * z paska albo strzałką z klawiatury. To samo robi zdjęcie przeciągnięte
 * palcem w aplikacji (Blocks.nudgePhoto), więc notatkę układa się tak samo
 * tu i tam.
 *
 * Wiersz ze zdjęciami leży w poprzek, a notatka w pionie, więc kierunek
 * znaczy w nim co innego:
 *
 * - w bok, mając sąsiada w wierszu: zamiana miejscami z tym sąsiadem;
 * - w prawo, stojąc samo pod zdjęciem: wchodzi do jego wiersza, obok niego;
 * - w pionie, stojąc w wierszu z innymi: schodzi do własnego wiersza;
 * - w pionie, stojąc samo: idzie o jeden blok wyżej albo niżej.
 */
export function nudgePhoto(
  blocks: TextBlock[],
  index: number,
  nudge: PhotoNudge,
): PhotoMove {
  const stay = { blocks, index };
  if (blocks[index]?.kind !== "image") return stay;
  const row = textBlockRows(blocks).find((group) => group.includes(index)) ?? [index];
  const inside = row.indexOf(index);
  const alone = row.length === 1;

  switch (nudge) {
    case "left":
      return inside > 0 ? movePhoto(blocks, index, true) : stay;
    case "right":
      if (inside < row.length - 1) return movePhoto(blocks, index, false);
      return alone ? setPhotoBeside(blocks, index, true) : stay;
    case "up":
      return alone ? movePhoto(blocks, index, true) : setPhotoBeside(blocks, index, false);
    case "down":
      return alone
        ? movePhoto(blocks, index, false)
        : setPhotoBeside(blocks, index, false);
    default:
      return stay;
  }
}

/**
 * Skleja bloki z powrotem w treść notatki. Puste bloki tekstu przepadają, bo
 * są tylko miejscem do pisania - notatka nie ma przez nie tyć o puste wiersze
 * przy każdym otwarciu.
 */
export function joinTextBlocks(blocks: TextBlock[]): string {
  const written = blocks.filter((block) => block.kind !== "text" || block.text !== "");
  const out: string[] = [];

  written.forEach((block, index) => {
    const before = written[index - 1];
    const text =
      block.kind === "text"
        ? block.text
        : writeImage({
            alt: block.alt,
            target: block.target,
            width: block.width,
            align: block.align,
          });
    // Zdjęcia stojące obok siebie idą do JEDNEGO wiersza, rozdzielone samym
    // odstępem. Nowy wiersz rozsunąłby je z powrotem jedno pod drugie.
    if (index > 0 && block.kind === "image" && block.beside && before?.kind === "image") {
      out[out.length - 1] += " " + text;
    } else {
      out.push(text);
    }
  });

  return out.join("\n");
}


/*
  Listy nie mają tu już własnej obsługi. W panelu WWW notatkę pisze się
  w polu z gotowym wyglądem (RichText.tsx), gdzie listę prowadzi sama
  przeglądarka - Enter zaczyna kolejną pozycję, a numerowanie liczy ona
  po swojemu. Zapis listy w markdownie robi lib/rich-text.ts.
*/