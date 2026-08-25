import {
  IMAGE_FULL_WIDTH,
  readImageAlign,
  readImageAlt,
  readImageDestination,
  readImageLine,
  sideBySideWidths,
  writeImage,
  type ImageAlign,
  type ImageOnLine,
} from "./text-note";

/*
  Bogaty tekst: markdown <-> HTML.

  Notatka tekstowa trzyma treść w markdownie - tak czyta ją aplikacja na
  tablecie i tak wygląda plik notatki. Człowiek nie ma jednak oglądać znaczków:
  pogrubienie ma być grube już w trakcie pisania, a nie jako „**tekst**".
  Dlatego pole do pisania jest edytowalnym kawałkiem strony (contenteditable),
  a te dwie funkcje pilnują przekładu:

    markdownToHtml  - treść notatki na to, co widać w polu,
    htmlToMarkdown  - to, co widać w polu, z powrotem na treść notatki.

  Przekład musi być OBUSTRONNY: otwarcie notatki i zapisanie jej bez zmiany
  nie ma prawa przestawić w niej ani znaku. Pilnują tego testy w
  rich-text.test.ts (round-trip na całym zestawie znaczników).

  Świadome ujednolicenia - markdown zna kilka zapisów tej samej rzeczy, a my
  wracamy zawsze jednym:

    _kursywa_    -> *kursywa*        __gruby__  -> **gruby**
    * pozycja    -> - pozycja        1) pozycja -> 1. pozycja
    ***         -> ---

  Znaków nie ucieczkujemy (`\*`). Zapis z ukośnikiem czytałaby tylko część
  czytników markdownu, a na tablecie zobaczyłoby się wtedy gołe ukośniki -
  gorsze niż to, co miały ukryć. Kto wpisze gwiazdkę wokół słowa, dostanie
  kursywę; tak działa markdown i tak działa notatnik na tablecie.
*/

/* ------------------------------------------------------------------ */
/* Treść w wierszu: pogrubienia, odnośniki i reszta znaczków            */
/* ------------------------------------------------------------------ */

export type InlineKind = "bold" | "italic" | "strike" | "underline" | "mark";

export type Inline =
  | { kind: "text"; text: string }
  /** Złamanie wiersza wewnątrz akapitu (w markdownie zwykły znak nowej linii). */
  | { kind: "break" }
  | { kind: "code"; text: string }
  /*
    Zdjęcie. `align` to ułożenie CAŁEGO wiersza ze zdjęciami (lewo, środek,
    prawo) - siedzi w tytule zdjęcia, tak samo jak w aplikacji.
  */
  | { kind: "image"; alt: string; target: string; width: number; align: ImageAlign }
  | { kind: "link"; target: string; children: Inline[] }
  /*
    Barwa pisma. Markdown jej nie zna, więc - tak samo jak podkreślenie -
    zapisujemy ją znacznikiem HTML: <span style="color:#rrggbb">tekst</span>.
    Dokładnie ten zapis czyta aplikacja na tablecie (InlineStyle.kt), dzięki
    czemu pokolorowane słowo wygląda tak samo po obu stronach.
  */
  | { kind: "colour"; colour: string; children: Inline[] }
  /*
    Rozmiar pisma dla kawałka tekstu. Tak samo jak barwa: markdown tego nie zna,
    więc zapis idzie znacznikiem HTML - <span style="font-size:21px">tekst</span> -
    dokładnie takim, jaki pisze aplikacja na tablecie.
  */
  | { kind: "size"; px: number; children: Inline[] }
  | { kind: InlineKind; children: Inline[] };

/**
 * Barwa sprowadzona do „#rrggbb”. Przeglądarka oddaje ją raz jako „rgb(1, 2, 3)”,
 * raz jako „#ABC” - a aplikacja czyta wyłącznie sześć (albo osiem) znaków po
 * kratce. Cokolwiek innego (nazwa barwy, zapis, którego nie znamy) odpada,
 * żeby do treści notatki nie trafił zapis, którego tablet nie zrozumie.
 */
export function normaliseColour(value: string): string | null {
  const text = value.trim().toLowerCase();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);
  if (hex) {
    const digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      // Skrót „#abc" to to samo co „#aabbcc"; przezroczystość odpada.
      return "#" + Array.from(digits.slice(0, 3)).map((sign) => sign + sign).join("");
    }
    return "#" + digits.slice(0, 6);
  }

  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/][^)]*)?\)$/.exec(text);
  if (rgb) {
    const parts = [rgb[1], rgb[2], rgb[3]].map((part) => {
      const number = Math.round(Number(part));
      return Number.isFinite(number) ? Math.min(255, Math.max(0, number)) : null;
    });
    if (parts.some((part) => part === null)) return null;
    return "#" + parts.map((part) => (part as number).toString(16).padStart(2, "0")).join("");
  }

  return null;
}

/** Barwa wyjęta ze stylu znacznika („color: #abc; font-weight: bold”). */
export function colourFromStyle(style: string): string | null {
  // Sama barwa pisma, nie tło - „background-color" ma na końcu to samo słowo.
  const match = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(style);
  return match ? normaliseColour(match[1]) : null;
}

/** Rozmiar pisma wyjęty ze stylu znacznika („font-size: 21px”). Tylko piksele. */
export function sizeFromStyle(style: string): number | null {
  const match = /(?:^|;)\s*font-size\s*:\s*(\d+(?:\.\d+)?)px\s*(?:;|$)/i.exec(style);
  if (!match) return null;
  const px = Number(match[1]);
  return Number.isFinite(px) && px > 0 ? px : null;
}

/**
 * Barwne albo przeskalowane słowo w treści notatki. Cudzysłów może być
 * pojedynczy albo podwójny, a w stylu może stać kilka własności naraz -
 * tak zapisuje to i strona, i tablet.
 */
const SPAN_OPENING = /^<span\s+style\s*=\s*(?:"([^"]*)"|'([^']*)')\s*>/i;

/**
 * Znacznik span razem z jego domknięciem. Spany bywają zagnieżdżone (barwa
 * w rozmiarze), więc domknięcia szukamy licząc otwarcia i zamknięcia, a nie
 * pierwszym „</span>”. Zapis niedomknięty zostaje zwykłym tekstem - tak jak
 * dotąd.
 */
function matchSpan(rest: string): { style: string; inner: string; length: number } | null {
  const opening = SPAN_OPENING.exec(rest);
  if (!opening) return null;
  const lower = rest.toLowerCase();
  let depth = 1;
  let at = opening[0].length;
  while (depth > 0) {
    const open = lower.indexOf("<span", at);
    const close = lower.indexOf("</span>", at);
    if (close === -1) return null;
    if (open !== -1 && open < close) {
      depth += 1;
      at = open + "<span".length;
    } else {
      depth -= 1;
      at = close + "</span>".length;
    }
  }
  return {
    style: opening[1] ?? opening[2] ?? "",
    inner: rest.slice(opening[0].length, at - "</span>".length),
    length: at,
  };
}

/** Znaczniki parzyste. Dłuższe muszą stać przed krótszymi: `**` przed `*`. */
const PAIRS: { marker: string; kind: InlineKind }[] = [
  { marker: "**", kind: "bold" },
  { marker: "__", kind: "bold" },
  { marker: "~~", kind: "strike" },
  { marker: "==", kind: "mark" },
  { marker: "*", kind: "italic" },
  { marker: "_", kind: "italic" },
];

/**
 * Szuka zamknięcia znacznika. Zwraca miejsce zamknięcia albo -1.
 *
 * Pojedyncza gwiazdka nie może zamknąć się o podwójną (inaczej `*a**b*`
 * rozpadałoby się w środku), a treść między znacznikami musi być niepusta -
 * `**` samo w sobie to nie pogrubienie, tylko dwie gwiazdki.
 */
function closingAt(text: string, marker: string, from: number): number {
  for (let i = from; i <= text.length - marker.length; i += 1) {
    if (!text.startsWith(marker, i)) continue;
    if (marker.length === 1 && text.startsWith(marker + marker, i)) {
      // Podwójny znacznik - to zamknięcie należy do dłuższej pary.
      i += 1;
      continue;
    }
    /*
      Zbite znaczniki, na przykład „**gruby i *pochyły***": trzy gwiazdki na
      końcu zamykają najpierw kursywę, a dopiero potem pogrubienie. Para
      dwuznakowa bierze więc DWIE OSTATNIE gwiazdki ciągu, żeby pojedyncza
      miała czym się domknąć.
    */
    if (marker.length === 2) {
      let run = 0;
      while (text[i + run] === marker[0]) run += 1;
      if (run > marker.length) i += run - marker.length;
    }
    if (i === from) continue; // pusta zawartość
    return i;
  }
  return -1;
}

/**
 * Nawias domykający adres zdjęcia albo odnośnika, licząc od `from`.
 *
 * Nawiasy w nazwie pliku („zdjecie (2).png") liczą się parami, więc adres
 * kończy się dopiero tam, gdzie pierwszy nawias się domyka. Nowy wiersz
 * kończy szukanie: zapis zdjęcia nie przechodzi przez wiersze.
 */
function closingBracket(text: string, from: number): number {
  let depth = 1;
  for (let at = from; at < text.length; at += 1) {
    const sign = text[at];
    if (sign === "\n") return -1;
    if (sign === "(") depth += 1;
    if (sign === ")") {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  return -1;
}

/** Czyta wiersz markdownu na drzewko znaczników. */
export function parseInline(text: string): Inline[] {
  const nodes: Inline[] = [];
  let plain = "";
  let at = 0;

  const flush = () => {
    if (plain) nodes.push({ kind: "text", text: plain });
    plain = "";
  };

  while (at < text.length) {
    const rest = text.slice(at);

    if (rest[0] === "\n") {
      flush();
      nodes.push({ kind: "break" });
      at += 1;
      continue;
    }

    // Kod w tekście stoi najwyżej: w środku nic już nie znaczy.
    const code = /^`([^`]+)`/.exec(rest);
    if (code) {
      flush();
      nodes.push({ kind: "code", text: code[1] });
      at += code[0].length;
      continue;
    }

    /*
      Zdjęcie. Adres wolno zamknąć dopiero na nawiasie domykającym TEN zapis,
      bo nazwy plików z aplikacji potrafią same mieć nawiasy: „zdjecie (2).png".
      Nawiasy liczymy po kolei, więc zdjęcie stojące zaraz obok drugiego
      (`![a](a.png) ![b](b.png)`) nie połyka sąsiada - a właśnie tak stoją
      zdjęcia w jednym wierszu. Tytuł w cudzysłowie odcinamy od adresu osobno.
    */
    if (rest.startsWith("![")) {
      const opened = rest.indexOf("](");
      const closed = opened < 0 ? -1 : closingBracket(rest, opened + 2);
      const label = opened < 0 ? "" : rest.slice(2, opened);
      if (closed > 0 && !label.includes("]") && !label.includes("\n")) {
        const inside = rest.slice(opened + 2, closed);
        flush();
        const dest = readImageDestination(inside);
        const { alt, width } = readImageAlt(label, dest.title);
        nodes.push({
          kind: "image",
          alt,
          target: dest.target,
          width,
          align: readImageAlign(dest.title),
        });
        at += closed + 1;
        continue;
      }
    }

    const link = /^\[([^\]]*)\]\(([^)\s]*)\)/.exec(rest);
    if (link) {
      flush();
      nodes.push({ kind: "link", target: link[2], children: parseInline(link[1]) });
      at += link[0].length;
      continue;
    }

    // Barwa i rozmiar pisma. Stoją przed podkreśleniem, bo to też znaczniki HTML.
    const span = matchSpan(rest);
    if (span) {
      let colourValue = colourFromStyle(span.style);
      let px = sizeFromStyle(span.style);
      if (colourValue !== null || px !== null) {
        flush();
        let children = parseInline(span.inner);
        /*
          Zagnieżdżone spany sprowadzamy do jednego porządku: rozmiar na
          zewnątrz, barwa przy samej treści - obojętnie, w jakiej kolejności
          ktoś je zapisał. Dzięki temu zapis w notatce jest zawsze taki sam.
        */
        while (children.length === 1) {
          const only = children[0];
          if (only.kind === "colour" && colourValue === null) {
            colourValue = only.colour;
            children = only.children;
            continue;
          }
          if (only.kind === "size" && px === null) {
            px = only.px;
            children = only.children;
            continue;
          }
          break;
        }
        let out: Inline[] = children;
        if (colourValue) out = [{ kind: "colour", colour: colourValue, children: out }];
        if (px !== null) out = [{ kind: "size", px, children: out }];
        nodes.push(...out);
        at += span.length;
        continue;
      }
    }

    // Podkreślenia markdown nie ma, więc notatnik zapisuje je znacznikiem HTML -
    // tak samo robi aplikacja na tablecie.
    const underline = /^<u>([\s\S]*?)<\/u>/i.exec(rest);
    if (underline) {
      flush();
      nodes.push({ kind: "underline", children: parseInline(underline[1]) });
      at += underline[0].length;
      continue;
    }

    /*
      Podkreślnik w środku słowa nie zaczyna kursywy - inaczej „nazwa_pliku_1"
      wracałaby z notatki bez podkreślników, jako kursywa. Gwiazdki taką parę
      tworzą (tak samo liczy to CommonMark).
    */
    const wordBefore = at > 0 && /[\p{L}\p{N}]/u.test(text[at - 1]);
    const pair = PAIRS.find(
      (entry) =>
        rest.startsWith(entry.marker) && !(entry.marker.startsWith("_") && wordBefore),
    );
    if (pair) {
      const end = closingAt(rest, pair.marker, pair.marker.length);
      const afterClose = rest[end + pair.marker.length];
      const wordAfter = afterClose !== undefined && /[\p{L}\p{N}]/u.test(afterClose);
      if (end > 0 && !(pair.marker.startsWith("_") && wordAfter)) {
        flush();
        nodes.push({
          kind: pair.kind,
          children: parseInline(rest.slice(pair.marker.length, end)),
        });
        at += end + pair.marker.length;
        continue;
      }
    }

    plain += text[at];
    at += 1;
  }

  flush();
  return nodes;
}

const MARKDOWN_MARKER: Record<InlineKind, string> = {
  bold: "**",
  italic: "*",
  strike: "~~",
  mark: "==",
  underline: "",
};

/** Drzewko znaczników z powrotem na markdown. */
export function inlineToMarkdown(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "text":
          return node.text;
        case "break":
          return "\n";
        case "code":
          return `\`${node.text}\``;
        case "image":
          return writeImage({
            alt: node.alt,
            target: node.target,
            width: node.width,
            align: node.align,
          });
        case "link":
          return `[${inlineToMarkdown(node.children)}](${node.target})`;
        case "underline":
          return `<u>${inlineToMarkdown(node.children)}</u>`;
        case "colour": {
          const inner = inlineToMarkdown(node.children);
          // Barwa bez treści nie ma czego pokolorować.
          return inner ? `<span style="color:${node.colour}">${inner}</span>` : "";
        }
        case "size": {
          const inner = inlineToMarkdown(node.children);
          return inner ? `<span style="font-size:${node.px}px">${inner}</span>` : "";
        }
        default: {
          const marker = MARKDOWN_MARKER[node.kind];
          const inner = inlineToMarkdown(node.children);
          // Znacznik bez zawartości nie ma czego objąć - zniknąłby przy
          // najbliższym odczycie i tak.
          return inner ? marker + inner + marker : "";
        }
      }
    })
    .join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const HTML_TAG: Record<InlineKind, string> = {
  bold: "strong",
  italic: "em",
  strike: "s",
  mark: "mark",
  underline: "u",
};

const SAFE_SCHEME = /^(https?:|mailto:|tel:)/i;

/**
 * Adres z treści notatki. Notatkę można udostępnić obcej osobie, więc odnośnik
 * `javascript:...` nie ma prawa nigdzie dojechać - a adres bez schematu
 * (`assets/kot.png`, `/note/123`) jest nasz własny i zostaje.
 *
 * Białe znaki wycinamy przed sprawdzeniem schematu, bo przeglądarka i tak je
 * pomija: „java\tscript:" to dla niej „javascript:".
 */
export function safeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const bare = Array.from(trimmed).filter((sign) => sign > " ").join("");
  if (/^[a-z][a-z0-9+.-]*:/i.test(bare) && !SAFE_SCHEME.test(bare)) return "#";
  return trimmed;
}

export type HtmlOptions = {
  /**
   * Zamiana adresu zdjęcia na taki, spod którego przeglądarka je pobierze.
   * Pierwotny zapis zostaje w `data-target`, więc droga powrotna na markdown
   * oddaje dokładnie to, co było w notatce.
   */
  imageUrl?: (target: string) => string;
};

function imageHtml(
  node: { alt: string; target: string; width: number; align?: ImageAlign },
  options: HtmlOptions,
  /*
    Szerokość do POKAZANIA. Zdjęcia stojące obok siebie schodzą tak, żeby
    zmieściły się w wierszu, ale w notatce zostaje ta szerokość, którą ktoś
    wybrał - dlatego prawdziwa idzie osobno, w `data-width`, i to ona wraca
    do treści notatki.
  */
  shown = node.width,
): string {
  const source = options.imageUrl ? options.imageUrl(node.target) : node.target;
  const target =
    source === node.target ? "" : ` data-target="${escapeHtml(node.target)}"`;
  // W atrybucie alt zostaje sam opis; szerokość idzie w styl, bo kanoniczny
  // dopisek `|60%` nie jest tekstem dla człowieka - patrz text-note.ts.
  const size = shown < IMAGE_FULL_WIDTH ? ` style="width:${Math.round(shown)}%"` : "";
  const stored =
    node.width < IMAGE_FULL_WIDTH ? ` data-width="${Math.round(node.width)}"` : "";
  const align = node.align && node.align !== "left" ? ` data-align="${node.align}"` : "";
  return `<img src="${escapeHtml(safeUrl(source))}" alt="${escapeHtml(node.alt)}"${target}${stored}${align}${size}>`;
}

/** Odstęp między zdjęciami stojącymi obok siebie, w procentach szerokości. */
const PHOTO_GAP_SHARE = 2;

/**
 * Wiersz ze zdjęciami na jeden akapit. Zdjęcia stoją obok siebie, a ułożenie
 * (lewo, środek, prawo) ma cały wiersz - tak samo jak na kartce w aplikacji.
 */
function imageRowHtml(photos: ImageOnLine[], options: HtmlOptions): string {
  const gap = PHOTO_GAP_SHARE * (photos.length - 1);
  const shown = sideBySideWidths(
    photos.map((photo) => photo.width),
    photos.length > 1 ? gap : 0,
  );
  const align = photos[0].align;
  const mark = align === "left" ? "" : ` data-align="${align}"`;
  const images = photos
    .map((photo, index) => imageHtml(photo, options, shown[index]))
    .join(" ");
  return `<p class="photo-row"${mark}>${images}</p>`;
}

function inlineToHtml(nodes: Inline[], options: HtmlOptions = {}): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "text":
          return escapeHtml(node.text);
        case "break":
          return "<br>";
        case "code":
          return `<code>${escapeHtml(node.text)}</code>`;
        case "image":
          return imageHtml(node, options);
        case "link":
          return `<a href="${escapeHtml(safeUrl(node.target))}">${inlineToHtml(node.children, options)}</a>`;
        case "colour":
          return `<span style="color:${escapeHtml(node.colour)}">${inlineToHtml(node.children, options)}</span>`;
        case "size":
          return `<span style="font-size:${node.px}px">${inlineToHtml(node.children, options)}</span>`;
        default: {
          const tag = HTML_TAG[node.kind];
          return `<${tag}>${inlineToHtml(node.children, options)}</${tag}>`;
        }
      }
    })
    .join("");
}

/* ------------------------------------------------------------------ */
/* Markdown -> HTML                                                     */
/* ------------------------------------------------------------------ */

/*
  Nagłówek to JEDEN znacznik wiersza. Doklejanie „## " do „# Tytuł"
  dawało „## # Tytuł": stary parser chował tylko zewnętrzne kratki, a
  wewnętrzne `#` wychodziły na wierzch w <h2>. Dlatego kratki - także
  poskładane z poprzednich przełączeń H1/H2/H3 - schodzą wszystkie,
  zanim wiersz stanie się nagłówkiem. Kajet zna trzy poziomy; czwarty
  i dalsze zostają zwykłym tekstem.
*/
const HEADING_MAX = 3;

/**
 * Długość kratek na początku wiersza - także poskładanych
 * („## # Tytuł"). Zero, gdy wiersz nie jest nagłówkiem H1-H3.
 */
export function headingPrefixLength(line: string): number {
  let i = 0;
  let consumed = 0;
  while (i < line.length && line[i] === "#") {
    let hashes = 0;
    while (i < line.length && line[i] === "#") {
      hashes += 1;
      i += 1;
    }
    if (hashes < 1 || hashes > HEADING_MAX) break;
    if (i < line.length && line[i] === " ") {
      i += 1;
      consumed = i;
      continue;
    }
    // Ogonek bez spacji po już zdjętej kratce („## #") - to nadal
    // znacznik, nie treść. Samo „###" bez spacji zostaje tekstem.
    if (consumed > 0 && i === line.length) consumed = i;
    break;
  }
  return consumed;
}

/** Nagłówek H1-H3; poziom bierze się z pierwszej grupy kratek. */
export function headingLine(line: string): { level: number; body: string } | null {
  const prefix = headingPrefixLength(line);
  if (prefix === 0) return null;
  let level = 0;
  while (level < line.length && line[level] === "#") level += 1;
  return {
    level: Math.min(HEADING_MAX, Math.max(1, level)),
    body: line.slice(prefix),
  };
}

/** Lista, zadanie, cytat - wszystko, co nie jest kratkami nagłówka. */
const OTHER_LINE_PREFIX = /^(?:> |[-*+] \[[ xX]] |[-*+] |\d+[.)] )/;

/**
 * Długość znacznika wiersza: poskładane kratki, a za nimi ewentualnie
 * lista albo cytat. Przy przełączaniu nagłówek i lista zastępują się,
 * zamiast się doklejać.
 */
export function lineMarkupLength(line: string): number {
  const headingLen = headingPrefixLength(line);
  const other = OTHER_LINE_PREFIX.exec(line.slice(headingLen))?.[0] ?? "";
  return headingLen + other.length;
}

/**
 * Wklejony zwykły tekst na HTML pola. Wiersz nagłówka staje się `<h1>`-`<h3>`
 * z jedną kratką, żeby późniejsze przełączenie z paska nie dokleiło drugiej.
 */
export function plainTextToPasteHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = escaped.split(/\n{2,}/).map(chunkToPasteHtml).join("");
  return html || "<p><br></p>";
}

function chunkToPasteHtml(chunk: string): string {
  if (!chunk) return "<p><br></p>";
  const parts: string[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length === 0) return;
    parts.push(`<p>${paragraph.join("<br>")}</p>`);
    paragraph = [];
  };
  for (const line of chunk.split("\n")) {
    const heading = headingLine(line);
    if (heading) {
      flush();
      parts.push(`<h${heading.level}>${heading.body || "<br>"}</h${heading.level}>`);
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return parts.join("");
}

const QUOTE = /^\s*>\s?(.*)$/;
const RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_SPLIT = /^\s*\|[\s|:-]+\|\s*$/;
const LIST_LINE = /^(\s*)([-*]|\d+[.)])\s+(.*)$/;
const TASK_TEXT = /^\[([ xX])\]\s+(.*)$/;

type ListKindMd = "bullet" | "number" | "task";
type ListEntry = { text: string; done: boolean; indent: number; kind: ListKindMd };

function listEntry(line: string): ListEntry | null {
  const match = LIST_LINE.exec(line);
  if (!match) return null;
  const [, indent, marker, rest] = match;
  const task = TASK_TEXT.exec(rest);
  if (task) {
    return {
      text: task[2],
      done: task[1].toLowerCase() === "x",
      indent: indent.length,
      kind: "task",
    };
  }
  return {
    text: rest,
    done: false,
    indent: indent.length,
    kind: /^\d/.test(marker) ? "number" : "bullet",
  };
}

/** Buduje jedną listę (razem z podlistami) z wierszy o rosnącym wcięciu. */
function listToHtml(
  entries: ListEntry[],
  from: number,
  options: HtmlOptions,
): { html: string; next: number } {
  const own = entries[from].indent;
  const kind = entries[from].kind;
  const tag = kind === "number" ? "ol" : "ul";
  const parts: string[] = [];
  let at = from;

  while (at < entries.length && entries[at].indent >= own) {
    const entry = entries[at];
    if (entry.indent > own) {
      // Podlista wchodzi w ostatnią pozycję - tak zapisuje ją markdown.
      const nested = listToHtml(entries, at, options);
      const last = parts.pop() ?? "<li></li>";
      parts.push(last.replace(/<\/li>$/, `${nested.html}</li>`));
      at = nested.next;
      continue;
    }
    if (entry.kind !== kind) break;

    const body = inlineToHtml(parseInline(entry.text), options);
    parts.push(
      kind === "task"
        ? `<li data-done="${entry.done ? "true" : "false"}">${body}</li>`
        : `<li>${body}</li>`,
    );
    at += 1;
  }

  const attribute = kind === "task" ? ' data-kind="task"' : "";
  return { html: `<${tag}${attribute}>${parts.join("")}</${tag}>`, next: at };
}

function tableCells(line: string): string[] {
  const inner = TABLE_ROW.exec(line)?.[1] ?? "";
  return inner.split("|").map((cell) => cell.trim());
}

/**
 * Treść notatki (albo jej kawałek) na HTML do pola pisania.
 *
 * Wynik jest umyślnie prosty: te same znaczniki, które umie odczytać
 * `htmlToMarkdown`. Przeglądarka podczas pisania dołoży do niego swoje, ale
 * powrotna droga i tak wszystko sprowadza do tego zestawu.
 */
export function markdownToHtml(markdown: string, options: HtmlOptions = {}): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let paragraph: string[] = [];

  const closeParagraph = () => {
    if (paragraph.length === 0) return;
    out.push(`<p>${inlineToHtml(parseInline(paragraph.join("\n")), options)}</p>`);
    paragraph = [];
  };

  let at = 0;
  while (at < lines.length) {
    const line = lines[at];
    const fence = /^\s*(```|\$\$)\s*$/.exec(line);
    if (fence) {
      closeParagraph();
      const closer = fence[1];
      const body: string[] = [];
      at += 1;
      while (at < lines.length && lines[at].trim() !== closer) {
        body.push(lines[at]);
        at += 1;
      }
      at += 1; // wiersz zamykający
      const kind = closer === "$$" ? "math" : "code";
      out.push(`<pre data-kind="${kind}">${escapeHtml(body.join("\n"))}</pre>`);
      continue;
    }

    if (RULE.test(line)) {
      closeParagraph();
      out.push("<hr>");
      at += 1;
      continue;
    }

    const heading = headingLine(line);
    if (heading) {
      closeParagraph();
      out.push(
        `<h${heading.level}>${inlineToHtml(parseInline(heading.body), options)}</h${heading.level}>`,
      );
      at += 1;
      continue;
    }

    if (listEntry(line)) {
      closeParagraph();
      const entries: ListEntry[] = [];
      while (at < lines.length) {
        const entry = listEntry(lines[at]);
        if (!entry) break;
        entries.push(entry);
        at += 1;
      }
      let index = 0;
      while (index < entries.length) {
        const built = listToHtml(entries, index, options);
        out.push(built.html);
        index = built.next;
      }
      continue;
    }

    if (TABLE_ROW.test(line)) {
      closeParagraph();
      const rows: string[][] = [];
      while (at < lines.length && TABLE_ROW.test(lines[at])) {
        if (!TABLE_SPLIT.test(lines[at])) rows.push(tableCells(lines[at]));
        at += 1;
      }
      const html = rows
        .map((cells, row) => {
          const tag = row === 0 ? "th" : "td";
          const inner = cells
            .map((cell) => `<${tag}>${inlineToHtml(parseInline(cell), options)}</${tag}>`)
            .join("");
          return `<tr>${inner}</tr>`;
        })
        .join("");
      out.push(`<table>${html}</table>`);
      continue;
    }

    const quote = QUOTE.exec(line);
    if (quote) {
      closeParagraph();
      const body: string[] = [];
      while (at < lines.length) {
        const next = QUOTE.exec(lines[at]);
        if (!next) break;
        body.push(next[1]);
        at += 1;
      }
      out.push(`<blockquote>${inlineToHtml(parseInline(body.join("\n")), options)}</blockquote>`);
      continue;
    }

    // Wiersz ze zdjęciami - jednym albo kilkoma obok siebie - jest własnym
    // akapitem, tak samo jak w aplikacji. Inaczej ułożenie wiersza nie miałoby
    // na czym usiąść, a zdjęcia zlewałyby się z sąsiednim zdaniem.
    const photos = readImageLine(line);
    if (photos) {
      closeParagraph();
      out.push(imageRowHtml(photos, options));
      at += 1;
      continue;
    }

    if (!line.trim()) {
      closeParagraph();
      at += 1;
      continue;
    }

    paragraph.push(line);
    at += 1;
  }

  closeParagraph();
  // Puste pole i tak musi mieć w czym postawić kursor.
  return out.join("") || "<p><br></p>";
}

/* ------------------------------------------------------------------ */
/* Markdown -> sam tekst (do liczenia słów i znaków)                    */
/* ------------------------------------------------------------------ */

/** Drzewko znaczników na goły tekst - bliźniak `inlineToHtml`. */
function inlineToPlain(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "text":
          return node.text;
        case "break":
          return "\n";
        // Kod w wierszu widać, więc się liczy - same grawisy już nie.
        case "code":
          return node.text;
        // Zdjęcia nie liczymy wcale: ani zapisu ![opis](assets/plik.png), ani
        // opisu, którego na kartce nie widać.
        case "image":
          return "";
        // Z odnośnika zostaje sam napis - adresu człowiek nie widzi.
        case "link":
          return inlineToPlain(node.children);
        default:
          return inlineToPlain(node.children);
      }
    })
    .join("");
}

/**
 * Treść notatki bez znaczników - to, co człowiek widzi na kartce.
 *
 * Idzie tym samym przebiegiem po wierszach co `markdownToHtml` i po tych
 * samych wyrażeniach, bo inaczej powstałyby dwie prawdy o jednym zapisie:
 * jedna do rysowania, druga do liczenia.
 *
 * Puste wiersze zostają, żeby dało się policzyć akapity.
 */
export function markdownToPlain(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];

  let at = 0;
  while (at < lines.length) {
    const line = lines[at];

    // Blok kodu i wzór: treść w środku widać, płotu nie.
    const fence = /^\s*(```|\$\$)\s*$/.exec(line);
    if (fence) {
      const closer = fence[1];
      at += 1;
      while (at < lines.length && lines[at].trim() !== closer) {
        out.push(lines[at]);
        at += 1;
      }
      at += 1;
      continue;
    }

    // Linia pozioma to nie tekst.
    if (RULE.test(line)) {
      at += 1;
      continue;
    }

    // Kreski pod nagłówkiem tabeli (|---|---|) to sama budowa.
    if (TABLE_SPLIT.test(line)) {
      at += 1;
      continue;
    }

    const table = TABLE_ROW.exec(line);
    if (table) {
      out.push(tableCells(line).map((cell) => inlineToPlain(parseInline(cell))).join(" "));
      at += 1;
      continue;
    }

    const heading = headingLine(line);
    if (heading) {
      out.push(inlineToPlain(parseInline(heading.body)));
      at += 1;
      continue;
    }

    const quote = QUOTE.exec(line);
    if (quote) {
      out.push(inlineToPlain(parseInline(quote[1])));
      at += 1;
      continue;
    }

    const entry = listEntry(line);
    if (entry) {
      out.push(inlineToPlain(parseInline(entry.text)));
      at += 1;
      continue;
    }

    out.push(inlineToPlain(parseInline(line)));
    at += 1;
  }

  return out.join("\n");
}

/* ------------------------------------------------------------------ */
/* HTML -> markdown                                                     */
/* ------------------------------------------------------------------ */

export type HtmlElement = {
  tag: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
};

export type HtmlNode = { text: string } | HtmlElement;

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "col"]);

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * Mały czytnik HTML-a. Nie udaje przeglądarki - wystarcza mu to, co wychodzi
 * z pola do pisania (i z `markdownToHtml`), czyli poprawnie domknięte
 * znaczniki. Czego nie zrozumie, to i tak przepuszcza dalej jako treść.
 */
export function parseHtml(html: string): HtmlNode[] {
  const root: HtmlNode[] = [];
  const stack: { tag: string; children: HtmlNode[] }[] = [];
  const children = () => (stack.length ? stack[stack.length - 1].children : root);
  let at = 0;

  while (at < html.length) {
    const open = html.indexOf("<", at);
    if (open === -1) {
      const text = decodeEntities(html.slice(at));
      if (text) children().push({ text });
      break;
    }
    if (open > at) {
      const text = decodeEntities(html.slice(at, open));
      if (text) children().push({ text });
    }

    if (html.startsWith("<!--", open)) {
      const end = html.indexOf("-->", open);
      at = end === -1 ? html.length : end + 3;
      continue;
    }

    const close = html.indexOf(">", open);
    if (close === -1) break;
    const raw = html.slice(open + 1, close).trim();
    at = close + 1;
    if (!raw) continue;

    if (raw[0] === "/") {
      const tag = raw.slice(1).trim().toLowerCase();
      // Domykamy też wszystko, co ktoś zostawił otwarte w środku.
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const name = /^[a-z0-9]+/i.exec(raw)?.[0]?.toLowerCase();
    if (!name) continue;
    const attrs: Record<string, string> = {};
    const attrPattern = /([a-z_:][a-z0-9_.:-]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/gi;
    let attr: RegExpExecArray | null;
    const attrText = raw.slice(name.length);
    while ((attr = attrPattern.exec(attrText))) {
      const value = attr[2] ?? "";
      attrs[attr[1].toLowerCase()] = decodeEntities(
        value.startsWith('"') || value.startsWith("'") ? value.slice(1, -1) : value,
      );
    }

    const node: HtmlNode = { tag: name, attrs, children: [] };
    children().push(node);
    if (!VOID_TAGS.has(name) && !raw.endsWith("/")) {
      stack.push({ tag: name, children: node.children });
    }
  }

  return root;
}

function isElement(node: HtmlNode): node is HtmlElement {
  return "tag" in node;
}

/** Twarda spacja z pola do pisania. W treści notatki ma być zwykła. */
function plainSpaces(text: string): string {
  return text.replace(/ /g, " ");
}

/** Znaczniki, które przeglądarka wstawia zamiast naszych. */
const INLINE_TAGS: Record<string, InlineKind> = {
  b: "bold",
  strong: "bold",
  i: "italic",
  em: "italic",
  s: "strike",
  strike: "strike",
  del: "strike",
  u: "underline",
  ins: "underline",
  mark: "mark",
};

/**
 * Wygląd zapisany stylem, a nie znacznikiem. Tak potrafi wyjść pogrubienie
 * z wklejonego tekstu albo ze starszej przeglądarki.
 */
function kindsFromStyle(style: string): InlineKind[] {
  const kinds: InlineKind[] = [];
  const value = style.toLowerCase();
  if (/font-weight\s*:\s*(bold|[6-9]00)/.test(value)) kinds.push("bold");
  if (/font-style\s*:\s*italic/.test(value)) kinds.push("italic");
  if (/text-decoration[^;]*line-through/.test(value)) kinds.push("strike");
  if (/text-decoration[^;]*underline/.test(value)) kinds.push("underline");
  if (/background(-color)?\s*:\s*(?!transparent|initial|none)[^;]+/.test(value)) {
    kinds.push("mark");
  }
  return kinds;
}

/** Zbiera treść wiersza: wszystko, co nie jest osobnym blokiem. */
function inlineFromHtml(nodes: HtmlNode[]): Inline[] {
  const out: Inline[] = [];

  for (const node of nodes) {
    if (!isElement(node)) {
      // Przeglądarka lubi twardą spację - w treści notatki ma być zwykła.
      out.push({ kind: "text", text: plainSpaces(node.text) });
      continue;
    }

    const tag = node.tag;
    if (tag === "br") {
      out.push({ kind: "break" });
      continue;
    }
    if (tag === "img") {
      /*
        Szerokość bierzemy z `data-width`, bo styl mógł zostać ściągnięty na
        potrzeby wiersza (zdjęcia obok siebie schodzą tak, żeby się zmieściły).
        Bez tego samo otwarcie notatki zapisywałoby zdjęciu mniejszą szerokość
        niż wybrana.
      */
      const stored = node.attrs["data-width"];
      const styleWidth = /(?:^|;)\s*width\s*:\s*(\d{1,3})\s*%/i.exec(node.attrs.style ?? "");
      const percent = stored || (styleWidth ? styleWidth[1] : "");
      const { alt, width } = readImageAlt(node.attrs.alt ?? "", percent ? `${percent}%` : "");
      out.push({
        kind: "image",
        alt,
        // `data-target` trzyma zapis z notatki (assets/kot.png), a `src` adres,
        // spod którego przeglądarka wzięła zdjęcie. Do notatki wraca ten pierwszy.
        target: node.attrs["data-target"] || node.attrs.src || "",
        width,
        align: readImageAlign(node.attrs["data-align"] ?? ""),
      });
      continue;
    }
    if (tag === "code") {
      out.push({ kind: "code", text: plainText(node.children) });
      continue;
    }
    if (tag === "a") {
      out.push({
        kind: "link",
        target: node.attrs.href ?? "",
        children: inlineFromHtml(node.children),
      });
      continue;
    }

    const known = INLINE_TAGS[tag];
    const style = node.attrs.style ?? "";
    const styled = kindsFromStyle(style);
    const kinds = known ? [known, ...styled.filter((kind) => kind !== known)] : styled;
    // Barwa i rozmiar pisma są osobnymi opakowaniami - barwa ma być najbliżej
    // treści, żeby zapis z notatki wyszedł taki sam po ponownym otwarciu.
    const colour = colourFromStyle(style);
    const size = sizeFromStyle(style);

    if (kinds.length > 0 || colour || size !== null) {
      // Kilka wyglądów naraz (na przykład gruby i pochylony span) zawijamy
      // jeden w drugi, żeby w markdownie wyszły oba znaczniki.
      let inner = inlineFromHtml(node.children);
      if (colour) inner = [{ kind: "colour", colour, children: inner }];
      if (size !== null) inner = [{ kind: "size", px: size, children: inner }];
      for (let i = kinds.length - 1; i >= 0; i -= 1) {
        inner = [{ kind: kinds[i], children: inner }];
      }
      out.push(...inner);
      continue;
    }

    // Wszystko inne (span, font, nieznane) jest przezroczyste.
    out.push(...inlineFromHtml(node.children));
  }

  return out;
}

/**
 * Sama treść, bez znaczników - do bloku kodu i do `<code>`.
 *
 * Przeglądarka łamie wiersze w bloku kodu raz `<br>`, raz `<div>`, zależnie od
 * tego, jak się je wpisało. Oba znaczą to samo: nowy wiersz.
 */
function plainText(nodes: HtmlNode[]): string {
  const text = nodes
    .map((node) => {
      if (!isElement(node)) return plainSpaces(node.text);
      if (node.tag === "br") return "\n";
      const inner = plainText(node.children);
      return node.tag === "div" || node.tag === "p" ? `\n${inner}` : inner;
    })
    .join("");
  return text.replace(/^\n/, "");
}

function inlineMarkdown(nodes: HtmlNode[]): string {
  return inlineToMarkdown(inlineFromHtml(nodes));
}

const BLOCK_TAGS = new Set([
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "ul",
  "ol",
  "li",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "figure",
  "section",
  "article",
]);

function listItems(node: HtmlElement, indent: string): string[] {
  const lines: string[] = [];
  const ordered = node.tag === "ol";
  const task = node.attrs["data-kind"] === "task";
  let number = 1;

  for (const child of node.children) {
    if (!isElement(child) || child.tag !== "li") continue;

    // Podlisty wyjmujemy z pozycji: idą osobnymi wierszami, z wcięciem.
    const nested: { tag: string; attrs: Record<string, string>; children: HtmlNode[] }[] = [];
    const own = child.children.filter((part) => {
      if (isElement(part) && (part.tag === "ul" || part.tag === "ol")) {
        nested.push(part);
        return false;
      }
      return true;
    });

    const marker = task
      ? `- [${child.attrs["data-done"] === "true" ? "x" : " "}] `
      : ordered
        ? `${number++}. `
        : "- ";
    const text = inlineMarkdown(own).replace(/\n/g, " ").trim();
    lines.push(indent + marker + text);
    for (const list of nested) {
      lines.push(...listItems(list, indent + "  "));
    }
  }

  return lines;
}

/** Rozdziela treść wiersza od bloków, które przeglądarka w niej zostawiła. */
function splitBlocks(nodes: HtmlNode[]): { own: HtmlNode[]; nested: HtmlNode[] } {
  const own: HtmlNode[] = [];
  const nested: HtmlNode[] = [];
  for (const node of nodes) {
    if (isElement(node) && BLOCK_TAGS.has(node.tag)) nested.push(node);
    else own.push(node);
  }
  return { own, nested };
}

/**
 * To, co widać w polu do pisania, z powrotem na treść notatki.
 *
 * Bloki (akapity, nagłówki, listy) rozdziela pusty wiersz - dokładnie tak, jak
 * czyta je z powrotem `markdownToHtml` i jak pisze je notatnik na tablecie.
 */
export function htmlToMarkdown(html: string): string {
  const blocks: string[] = [];

  const walk = (nodes: HtmlNode[]) => {
    let inline: HtmlNode[] = [];

    const closeInline = () => {
      if (inline.length === 0) return;
      const text = inlineMarkdown(inline).replace(/[ \t]+$/gm, "");
      inline = [];
      if (text.trim()) blocks.push(text);
    };

    for (const node of nodes) {
      if (!isElement(node) || !BLOCK_TAGS.has(node.tag)) {
        inline.push(node);
        continue;
      }
      closeInline();

      switch (node.tag) {
        case "hr":
          blocks.push("---");
          break;
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6": {
          // Notatka zna trzy poziomy - głębsze schodzą do trzeciego.
          const level = Math.min(3, Number(node.tag[1]));
          const { own, nested } = splitBlocks(node.children);
          const raw = inlineMarkdown(own).replace(/\n/g, " ");
          // Wyciekłe kratki w treści nagłówka (`<h2># Tytuł</h2>`) schodzą,
          // żeby zapis miał dokładnie jeden znacznik.
          const text = raw.slice(headingPrefixLength(raw)).trim();
          if (text) blocks.push(`${"#".repeat(level)} ${text}`);
          // Zdarza się, że przeglądarka wsadzi w nagłówek całą listę. Taki
          // kawałek notatki ma zostać listą, a nie zlać się w jeden wiersz.
          if (nested.length > 0) walk(nested);
          break;
        }
        case "blockquote": {
          const { own, nested } = splitBlocks(node.children);
          const text = inlineMarkdown(own);
          if (text.trim()) {
            blocks.push(
              text
                .split("\n")
                .map((line) => `> ${line}`.trimEnd())
                .join("\n"),
            );
          }
          if (nested.length > 0) walk(nested);
          break;
        }
        case "pre": {
          const fence = node.attrs["data-kind"] === "math" ? "$$" : "```";
          blocks.push(`${fence}\n${plainText(node.children).replace(/\n$/, "")}\n${fence}`);
          break;
        }
        case "ul":
        case "ol": {
          const lines = listItems(node, "");
          if (lines.length > 0) blocks.push(lines.join("\n"));
          break;
        }
        case "table": {
          const rows: string[][] = [];
          const collect = (parts: HtmlNode[]) => {
            for (const part of parts) {
              if (!isElement(part)) continue;
              if (part.tag === "tr") {
                rows.push(
                  part.children
                    .filter((cell) => isElement(cell) && (cell.tag === "td" || cell.tag === "th"))
                    .map((cell) =>
                      inlineMarkdown((cell as { children: HtmlNode[] }).children)
                        .replace(/\n/g, " ")
                        .trim(),
                    ),
                );
                continue;
              }
              collect(part.children);
            }
          };
          collect(node.children);
          if (rows.length > 0) {
            const width = Math.max(...rows.map((row) => row.length));
            const line = (cells: string[]) =>
              `| ${Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ")} |`;
            const table = [line(rows[0]), `| ${Array(width).fill("---").join(" | ")} |`];
            for (const row of rows.slice(1)) table.push(line(row));
            blocks.push(table.join("\n"));
          }
          break;
        }
        default: {
          // p, div i reszta: akapit. W środku mogą jednak siedzieć kolejne
          // bloki (przeglądarka lubi zagnieżdżać div-y), więc wchodzimy głębiej.
          const hasBlocks = node.children.some(
            (child) => isElement(child) && BLOCK_TAGS.has(child.tag),
          );
          if (hasBlocks) {
            walk(node.children);
          } else {
            const text = inlineMarkdown(node.children).replace(/[ \t]+$/gm, "");
            // Pusty akapit to odstęp - w markdownie robi go już sam rozdział
            // między blokami, więc nie dokładamy niczego.
            if (text.trim()) blocks.push(text);
          }
        }
      }
    }

    closeInline();
  };

  walk(parseHtml(html));
  return blocks.join("\n\n");
}
