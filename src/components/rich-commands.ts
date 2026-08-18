"use client";

import { lineMarkupLength, plainTextToPasteHtml } from "@/lib/rich-text";

/*
  Polecenia paska narzędzi dla pola z bogatym tekstem.

  Wszystko idzie przez `document.execCommand`. Owszem, jest odradzany, ale to
  jedyna droga, która NIE ROZWALA COFANIA (Ctrl+Z): przeglądarka zapisuje sobie
  każdą taką zmianę w swojej historii. Ręczne grzebanie w drzewie strony
  wyglądałoby tak samo, tylko cofanie przestałoby działać w pół notatki.

  Zamiana na treść notatki (markdown) dzieje się osobno - patrz lib/rich-text.ts.
*/

export type MarkName = "bold" | "italic" | "underline" | "strike" | "mark" | "code";
export type BlockName =
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "blockquote"
  | "pre"
  | "ul"
  | "ol"
  | "task";

const EXEC_MARK: Record<string, string> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strike: "strikeThrough",
};

function run(command: string, value?: string): void {
  document.execCommand(command, false, value);
}

/**
 * Ustawienia pola do pisania. Bez nich Chrome pogrubia `<span style=...>`
 * zamiast `<b>`, a Enter robi `<div>` zamiast akapitu - jedno i drugie da się
 * odczytać, ale treść notatki wychodzi wtedy pełna śmieci.
 */
export function prepareEditing(): void {
  try {
    run("styleWithCSS", "false");
    run("defaultParagraphSeparator", "p");
  } catch {
    // Starsza przeglądarka może tych poleceń nie znać - reszta i tak działa.
  }
}

function selection(): Selection | null {
  const current = window.getSelection();
  return current && current.rangeCount > 0 ? current : null;
}

/** Najbliższy znacznik nad kursorem, nie wychodząc poza pole do pisania. */
function closest(node: Node | null | undefined, match: (element: HTMLElement) => boolean): HTMLElement | null {
  let current: Node | null = node ?? null;
  while (current) {
    if (current instanceof HTMLElement) {
      if (current.isContentEditable && current.dataset.richText === "1") return null;
      if (match(current)) return current;
    }
    current = current.parentNode;
  }
  return null;
}

function closestTag(node: Node | null | undefined, tag: string): HTMLElement | null {
  return closest(node, (element) => element.tagName.toLowerCase() === tag);
}

/** Pole do pisania, w którym stoi ten węzeł. */
function fieldOf(node: Node | null | undefined): HTMLElement | null {
  let current: Node | null = node ?? null;
  while (current) {
    if (current instanceof HTMLElement && current.dataset.richText === "1") return current;
    current = current.parentNode;
  }
  return null;
}

/**
 * Znaczniki `tag` objęte zaznaczeniem.
 *
 * Sam węzeł pod kursorem nie wystarcza. Zaznaczenie przeciągnięte przez całe
 * podświetlone słowo zaczyna się i kończy POZA nim - w akapicie - więc szukanie
 * „w górę drzewa" nic nie znajdowało i drugie kliknięcie w zakreślacz zamiast
 * zdjąć podświetlenie, dokładało kolejne. Dlatego bierzemy jeszcze wszystkie
 * znaczniki, które zaznaczenie przecina.
 */
function wrappedIn(current: Selection, tag: string): HTMLElement[] {
  const found = new Set<HTMLElement>();
  const above = closestTag(current.anchorNode, tag) ?? closestTag(current.focusNode, tag);
  if (above) found.add(above);

  const range = current.getRangeAt(0);
  if (!range.collapsed) {
    const field = fieldOf(range.commonAncestorContainer);
    for (const node of field ? Array.from(field.querySelectorAll(tag)) : []) {
      // Samo sąsiedztwo się nie liczy - intersectsNode wymaga wspólnego kawałka.
      if (node instanceof HTMLElement && range.intersectsNode(node)) found.add(node);
    }
  }

  return Array.from(found);
}

/** Zdejmuje znacznik, zostawiając jego treść. Idzie przez execCommand, więc cofanie działa. */
function unwrap(element: HTMLElement): void {
  // Przy kilku znacznikach naraz poprzednie zdjęcie mogło ten już usunąć.
  if (!element.isConnected) return;

  const current = selection();
  const inner = element.innerHTML;
  if (current && inner) {
    const range = document.createRange();
    range.selectNode(element);
    current.removeAllRanges();
    current.addRange(range);
    run("insertHTML", inner);
    if (!element.isConnected) return;
  }
  /*
    Zapasowa droga. Przeglądarka, kasując zaznaczenie obejmujące cały znacznik,
    potrafi zostawić po nim pustą skorupkę i wstawić treść z powrotem do środka -
    wtedy podświetlenie zdejmuje się z ręki. Cofanie takiej jednej zmiany może
    nie zadziałać, ale to i tak lepsze niż przycisk, który niczego nie zdejmuje.
  */
  stripTag(element);
}

/** Znacznik znika, jego treść zostaje na miejscu i pozostaje zaznaczona. */
function stripTag(element: HTMLElement): void {
  const parent = element.parentNode;
  if (!parent) return;

  const first = element.firstChild;
  const last = element.lastChild;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
  if (!first || !last) return;

  const range = document.createRange();
  range.setStartBefore(first);
  range.setEndAfter(last);
  const current = window.getSelection();
  current?.removeAllRanges();
  current?.addRange(range);
}

const BLOCK_INSIDE =
  "p, div, h1, h2, h3, h4, h5, h6, ul, ol, li, pre, blockquote, table, tr, td, th, hr";

/** Najbliższy blok nad kursorem - akapit, nagłówek, pozycja listy. */
function blockAbove(node: Node | null | undefined): HTMLElement | null {
  return closest(node, (element) => element.matches(BLOCK_INSIDE));
}

/**
 * Zawija zaznaczenie w znacznik (albo zdejmuje go, gdy już tam jest).
 *
 * Zaznaczenie sięgające przez kilka akapitów przycinamy do tego, w którym stoi
 * kursor. Inaczej „kod w tekście" na pół notatki zwinąłby ją w jeden blok kodu -
 * a że idzie to przez `insertHTML`, znikłyby przy okazji wszystkie akapity,
 * listy i nagłówki po drodze.
 */
function toggleWrap(tag: string): void {
  const current = selection();
  if (!current) return;

  const existing = wrappedIn(current, tag);
  if (existing.length > 0) {
    // Zaznaczenie potrafi objąć kilka podświetleń naraz - schodzą wszystkie.
    for (const element of existing) unwrap(element);
    return;
  }

  const range = current.getRangeAt(0);
  const block = blockAbove(current.anchorNode);
  if (block && !range.collapsed) {
    const own = document.createRange();
    own.selectNodeContents(block);
    if (range.compareBoundaryPoints(Range.START_TO_START, own) < 0) {
      range.setStart(own.startContainer, own.startOffset);
    }
    if (range.compareBoundaryPoints(Range.END_TO_END, own) > 0) {
      range.setEnd(own.endContainer, own.endOffset);
    }
    current.removeAllRanges();
    current.addRange(range);
  }

  const holder = document.createElement("div");
  holder.append(range.cloneContents());
  // Bez zaznaczenia wstawiamy słowo, żeby było w co wpisywać.
  const inner = holder.innerHTML || "tekst";
  run("insertHTML", `<${tag} id="${FRESH}">${inner}</${tag}>`);
  selectFresh();
}

/**
 * Świeżo wstawiony kawałek trzeba odnaleźć i zaznaczyć: `insertHTML` zostawia
 * kursor ZA nim, więc drugie kliknięcie w ten sam przycisk nie miałoby czego
 * zdjąć, a pasek nie wiedziałby, że znacznik jest włączony.
 */
const FRESH = "kajet-swiezo-wstawione";

function selectFresh(): void {
  const fresh = document.getElementById(FRESH);
  if (!fresh) return;
  fresh.removeAttribute("id");
  const range = document.createRange();
  range.selectNodeContents(fresh);
  const current = window.getSelection();
  current?.removeAllRanges();
  current?.addRange(range);
}

/**
 * Wstawianie gotowego kawałka (linia, tabela, wzór) zaczyna od zwinięcia
 * zaznaczenia. Bez tego kliknięcie w „Linia" przy zaznaczonej połowie notatki
 * skasowałoby ją - `insertHTML` wstawia W MIEJSCE zaznaczenia.
 */
function insertAfterSelection(html: string): void {
  window.getSelection()?.collapseToEnd();
  run("insertHTML", html);
}

export function toggleMark(mark: MarkName): void {
  if (mark === "mark") {
    toggleWrap("mark");
    return;
  }
  if (mark === "code") {
    toggleWrap("code");
    return;
  }
  run(EXEC_MARK[mark]);
}

function listAbove(): HTMLElement | null {
  const current = selection();
  return closest(
    current?.anchorNode,
    (element) => element.tagName === "UL" || element.tagName === "OL",
  );
}

/**
 * Nagłówki, cytat, listy i blok kodu. Kliknięcie w to, co już jest, wraca do
 * zwykłego akapitu - tak samo działał stary pasek na znaczkach.
 */
export function toggleBlock(block: BlockName): void {
  const current = selection();
  if (!current) return;

  if (block === "ul" || block === "ol" || block === "task") {
    const list = listAbove();
    const isTask = list?.dataset.kind === "task";

    if (block === "task") {
      if (isTask) {
        run("insertUnorderedList"); // drugi raz - lista znika
        return;
      }
      if (!list) run("insertUnorderedList");
      const made = listAbove();
      if (made) {
        made.dataset.kind = "task";
        for (const item of Array.from(made.children)) {
          if (item instanceof HTMLElement && !item.dataset.done) item.dataset.done = "false";
        }
      }
      return;
    }

    const wanted = block === "ul" ? "UL" : "OL";
    if (list && list.tagName === wanted && !isTask) {
      run(block === "ul" ? "insertUnorderedList" : "insertOrderedList");
      return;
    }
    run(block === "ul" ? "insertUnorderedList" : "insertOrderedList");
    const made = listAbove();
    if (made) delete made.dataset.kind;
    return;
  }

  /*
    Wyjście z listy przed zmianą bloku. Chrome zapytany o nagłówek, gdy kursor
    stoi w pozycji listy, zawija w `<h2>` CAŁĄ listę - wychodzi
    `<h2><ul><li>...</li></ul></h2>`, czyli notatka nie do odczytania. Dlatego
    najpierw zdejmujemy listę (tym samym poleceniem, które ją zakłada), a
    dopiero z gotowego akapitu robimy nagłówek, cytat albo blok kodu.
  */
  const item = closest(current.anchorNode, (element) => element.tagName === "LI");
  if (item) {
    const list = listAbove();
    run(list?.tagName === "OL" ? "insertOrderedList" : "insertUnorderedList");
  }

  // Nagłówek zdejmuje kratki z treści zanim zmieni znacznik - inaczej
  // formatBlock zostawiałby „# Tytuł" w środku H2, a zapis dokładałby kolejne.
  if (block === "h1" || block === "h2" || block === "h3") {
    toggleHeading(block);
    return;
  }

  // Blok kodu i cytat: przeglądarka sama przerabia akapit, więc nic po drodze
  // nie ginie.
  const inside = closestTag(current.anchorNode, block);
  run("formatBlock", inside ? "<p>" : `<${block}>`);

  // Pod świeżym blokiem kodu albo cytatem musi zostać akapit. Bez niego, gdy
  // blok stoi na końcu notatki, nie ma gdzie postawić kursora: Enter dopisuje
  // kolejne wiersze kodu i pisanie „niżej" przestaje istnieć.
  if (!inside && (block === "pre" || block === "blockquote")) {
    const made = closestTag(selection()?.anchorNode, block);
    if (made) paragraphAfter(made);
  }
}

/**
 * To samo H2 zdejmuje nagłówek; inne H zostawia dokładnie jeden poziom.
 * Kratki i znacznik listy/cytatu schodzą z treści, żeby się nie zagnieżdżały.
 */
function toggleHeading(block: "h1" | "h2" | "h3"): void {
  const host = blockAbove(selection()?.anchorNode);
  if (host) peelBlockMarkup(host);

  const current = closest(
    selection()?.anchorNode,
    (element) => /^H[1-3]$/.test(element.tagName),
  );
  if (current && current.tagName.toLowerCase() === block) {
    run("formatBlock", "<p>");
    return;
  }
  run("formatBlock", `<${block}>`);
}

/** Zaznaczenie pierwszych [count] widocznych znaków bloku. */
function leadingRange(root: HTMLElement, count: number): Range | null {
  if (count <= 0) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = count;
  let startNode: Text | null = null;
  let endNode: Text | null = null;
  let endOffset = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    if (text.length === 0) continue;
    if (!startNode) startNode = text;
    if (text.length >= remaining) {
      endNode = text;
      endOffset = remaining;
      remaining = 0;
      break;
    }
    remaining -= text.length;
    endNode = text;
    endOffset = text.length;
  }
  if (!startNode || !endNode || remaining > 0) return null;
  const range = document.createRange();
  range.setStart(startNode, 0);
  range.setEnd(endNode, endOffset);
  return range;
}

/** Kasuje kratki / listę / cytat z początku bloku przez execCommand (cofanie). */
function peelBlockMarkup(block: HTMLElement): void {
  const peel = lineMarkupLength(block.textContent ?? "");
  if (peel <= 0) return;
  const range = leadingRange(block, peel);
  if (!range) return;
  const current = selection();
  if (!current) return;
  current.removeAllRanges();
  current.addRange(range);
  run("delete");
}

/*
  --- Wychodzenie z bloku kodu i cytatu ---

  Blok kodu zjada Enter, bo w kodzie nowy wiersz to nowy wiersz. Dlatego
  potrzebne jest drugie wyjście, i to takie, którego ludzie próbują sami:
  Enter na pustym ostatnim wierszu (jak w każdym edytorze kodu) oraz Ctrl albo
  Cmd z Enterem z dowolnego miejsca bloku.
*/

/** Blok, który zjada Enter i bez pomocy nie da się z niego wyjść w dół. */
function trapBlock(node: Node | null | undefined): HTMLElement | null {
  return closest(
    node,
    (element) => element.tagName === "PRE" || element.tagName === "BLOCKQUOTE",
  );
}

/** Akapit pod blokiem - istniejący albo świeżo dołożony. */
function paragraphAfter(block: HTMLElement): HTMLElement {
  const next = block.nextElementSibling;
  if (next instanceof HTMLElement && next.tagName === "P") return next;
  const paragraph = document.createElement("p");
  paragraph.innerHTML = "<br>";
  block.parentNode?.insertBefore(paragraph, block.nextSibling);
  return paragraph;
}

/**
 * Domyka pole pustym akapitem, jeżeli kończy się blokiem, który zjada Enter.
 * Wołane po wczytaniu treści: notatka zapisana z blokiem kodu na końcu wraca
 * jako HTML kończący się na `<pre>`, więc bez tego po ponownym otwarciu znowu
 * nie byłoby gdzie pisać. Pusty akapit nie zostawia śladu w treści notatki -
 * markdown robi odstępy samym rozdziałem między blokami.
 */
export function ensureWritableEnd(field: HTMLElement): boolean {
  const last = field.lastElementChild;
  if (!(last instanceof HTMLElement)) return false;
  if (last.tagName !== "PRE" && last.tagName !== "BLOCKQUOTE") return false;
  paragraphAfter(last);
  return true;
}

/** Kursor stoi na końcu bloku - za nim jest już tylko pusty odstęp. */
function caretAtBlockEnd(block: HTMLElement, current: Selection): boolean {
  const range = current.getRangeAt(0);
  const rest = document.createRange();
  rest.selectNodeContents(block);
  try {
    rest.setStart(range.endContainer, range.endOffset);
  } catch {
    return false;
  }
  return rest.toString().trim() === "";
}

/** Ostatni wiersz bloku jest pusty - czyli ktoś właśnie nacisnął Enter. */
function endsWithEmptyLine(block: HTMLElement): boolean {
  const last = block.lastChild;
  if (last instanceof HTMLElement) {
    if (last.tagName === "BR") return true;
    if (
      (last.tagName === "DIV" || last.tagName === "P") &&
      !(last.textContent ?? "").trim()
    ) {
      return true;
    }
  }
  return /\n[ \t]*$/.test(block.textContent ?? "");
}

/** Zdejmuje ten pusty wiersz, żeby nie został w kodzie po wyjściu z bloku. */
function dropEmptyLastLine(block: HTMLElement): void {
  const last = block.lastChild;
  if (last instanceof HTMLElement) {
    if (
      last.tagName === "BR" ||
      ((last.tagName === "DIV" || last.tagName === "P") &&
        !(last.textContent ?? "").trim())
    ) {
      last.remove();
      return;
    }
  }
  if (last && last.nodeType === Node.TEXT_NODE) {
    last.textContent = (last.textContent ?? "").replace(/\n[ \t]*$/, "");
  }
}

/** Wychodzi z bloku kodu albo cytatu do akapitu pod nim. */
export function leaveBlock(): boolean {
  const block = trapBlock(selection()?.anchorNode);
  if (!block) return false;
  placeCaret(paragraphAfter(block));
  return true;
}

/**
 * Enter w bloku: pusty ostatni wiersz znaczy „wychodzę", każdy inny zostaje
 * zwykłym nowym wierszem kodu.
 */
export function leaveBlockOnEnter(): boolean {
  const current = selection();
  if (!current || !current.isCollapsed) return false;
  const block = trapBlock(current.anchorNode);
  if (!block) return false;
  if (!caretAtBlockEnd(block, current)) return false;
  if (!endsWithEmptyLine(block)) return false;

  dropEmptyLastLine(block);
  placeCaret(paragraphAfter(block));
  return true;
}

/** Strzałka w dół z ostatniego bloku notatki - zakłada akapit i wchodzi w niego. */
export function leaveBlockOnArrowDown(): boolean {
  const current = selection();
  if (!current || !current.isCollapsed) return false;
  const block = trapBlock(current.anchorNode);
  if (!block) return false;
  if (block.nextElementSibling) return false;
  if (!caretAtBlockEnd(block, current)) return false;
  placeCaret(paragraphAfter(block));
  return true;
}

/** Wzór - ten sam blok co kod, tylko oznaczony i zapisywany między $$. */
export function insertMath(): void {
  insertAfterSelection('<pre data-kind="math">a^2 + b^2</pre><p><br></p>');
}

export function insertRule(): void {
  insertAfterSelection("<hr><p><br></p>");
}

export function insertTable(): void {
  insertAfterSelection(
    "<table><tr><th>Kolumna</th><th>Kolumna</th></tr>" +
      "<tr><td>&nbsp;</td><td>&nbsp;</td></tr></table><p><br></p>",
  );
}

/*
  --- Barwa pisma ---

  Reszta paska pisze przez `styleWithCSS = false`, bo znaczniki (`<b>`, `<i>`)
  czytają się prościej niż style. Przy barwie jest odwrotnie: bez CSS-a Chrome
  wstawia dawno wycofany `<font color=...>`, którego treść notatki nie
  przewiduje - kolor przepadałby przy pierwszym zapisie. Dlatego na czas tego
  jednego polecenia włączamy zapis stylem i zaraz wracamy do znaczników.
*/
export function applyColour(colour: string): void {
  const value = colour.trim();
  if (!value) {
    clearColour();
    return;
  }
  try {
    run("styleWithCSS", "true");
    run("foreColor", value);
  } finally {
    run("styleWithCSS", "false");
  }
}

/** Barwne znaczniki objęte zaznaczeniem - wracają do barwy kartki. */
export function clearColour(): void {
  const current = selection();
  if (!current) return;

  for (const element of wrappedIn(current, "span")) {
    if (!element.style.color) continue;
    element.style.removeProperty("color");
    // Po zdjęciu barwy zostaje pusty `<span>` - bez treści notatki nic on nie
    // znaczy, więc znika razem ze swoim atrybutem.
    if (!element.getAttribute("style")) {
      element.removeAttribute("style");
      if (element.attributes.length === 0) stripTag(element);
    }
  }
}

/** Barwa pod kursorem - pasek pokazuje ją na przycisku. */
export function colourAtCursor(): string {
  const span = closest(
    selection()?.anchorNode,
    (element) => element instanceof HTMLElement && Boolean(element.style.color),
  );
  return span?.style.color ?? "";
}

/** Odnośnik. Bez zaznaczenia wstawia sam adres jako treść. */
export function applyLink(url: string): void {
  const address = url.trim();
  if (!address) {
    run("unlink");
    return;
  }
  const current = selection();
  if (current && current.isCollapsed) {
    run("insertHTML", `<a href="${address.replace(/"/g, "&quot;")}">${address}</a>`);
    return;
  }
  run("createLink", address);
}

/** Adres odnośnika, w którym stoi kursor - do podpowiedzi w pasku. */
export function linkAtCursor(): string {
  const link = closestTag(selection()?.anchorNode, "a");
  return link?.getAttribute("href") ?? "";
}

/** Wklejanie: sam tekst, bez cudzych stylów. Puste wiersze dzielą akapity. */
export function insertPlainText(text: string): void {
  run("insertHTML", plainTextToPasteHtml(text));
}

export type Formats = { marks: Set<MarkName>; blocks: Set<BlockName> };

/**
 * Co jest w tej chwili włączone pod kursorem - pasek podświetla wtedy swoje
 * przyciski, więc widać, że pisze się właśnie na grubo.
 */
export function activeFormats(): Formats {
  const marks = new Set<MarkName>();
  const blocks = new Set<BlockName>();

  for (const [mark, command] of Object.entries(EXEC_MARK) as [MarkName, string][]) {
    try {
      if (document.queryCommandState(command)) marks.add(mark);
    } catch {
      // queryCommandState bywa kapryśny - brak podświetlenia nikomu nie szkodzi.
    }
  }

  // Podświetlenie i kod szukamy tak samo, jak przy zdejmowaniu - inaczej pasek
  // pokazywałby przycisk wyłączony nad tekstem, z którego właśnie go zdejmie.
  const current = selection();
  const anchor = current?.anchorNode;
  if (current) {
    if (wrappedIn(current, "mark").length > 0) marks.add("mark");
    if (wrappedIn(current, "code").length > 0) marks.add("code");
  }

  for (const tag of ["h1", "h2", "h3", "blockquote", "pre"] as const) {
    if (closestTag(anchor, tag)) blocks.add(tag);
  }

  const list = closest(anchor, (element) => element.tagName === "UL" || element.tagName === "OL");
  if (list) {
    if (list.dataset.kind === "task") blocks.add("task");
    else blocks.add(list.tagName === "OL" ? "ol" : "ul");
  }

  return { marks, blocks };
}

/**
 * Tabulator w tabeli przechodzi do następnej komórki, a z ostatniej dokłada
 * wiersz. Bez tego tabeli nie dałoby się rozbudować, bo Tab wyprowadza kursor
 * poza pole do pisania.
 */
export function tabInTable(shift: boolean): boolean {
  const current = selection();
  const cell = closest(
    current?.anchorNode,
    (element) => element.tagName === "TD" || element.tagName === "TH",
  );
  if (!cell) return false;

  const table = closestTag(cell, "table");
  if (!table) return false;
  const cells = Array.from(table.querySelectorAll("td, th"));
  const at = cells.indexOf(cell);
  const next = shift ? cells[at - 1] : cells[at + 1];

  if (next) {
    placeCaret(next);
    return true;
  }
  if (shift) return true;

  // Ostatnia komórka: dokładamy wiersz o tylu kolumnach, ile ma tabela.
  const row = closestTag(cell, "tr");
  const width = row ? row.children.length : 1;
  const fresh = document.createElement("tr");
  for (let i = 0; i < width; i += 1) {
    const empty = document.createElement("td");
    empty.innerHTML = "&nbsp;";
    fresh.append(empty);
  }
  row?.parentNode?.insertBefore(fresh, row.nextSibling);
  placeCaret(fresh.firstElementChild ?? fresh);
  return true;
}

/** Stawia kursor na końcu pola - na przykład przed poleceniem z paska. */
export function focusEnd(field: HTMLElement): void {
  field.focus();
  placeCaret(field);
}

/** Zapamiętane zaznaczenie. Pasek odnośnika zabiera kursor z pola. */
export function saveRange(): Range | null {
  const current = selection();
  return current ? current.getRangeAt(0).cloneRange() : null;
}

export function restoreRange(range: Range | null): void {
  if (!range) return;
  const current = window.getSelection();
  current?.removeAllRanges();
  current?.addRange(range);
}

function placeCaret(element: Element): void {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const current = window.getSelection();
  current?.removeAllRanges();
  current?.addRange(range);
}

/** Odhacza pozycję listy zadań kliknięciem w kwadracik przy jej lewej krawędzi. */
export function toggleTaskAt(target: EventTarget | null, offsetX: number): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const item = closest(target, (element) => element.tagName === "LI");
  if (!item) return false;
  const list = item.parentElement;
  if (!list || list.dataset.kind !== "task") return false;
  // Kwadracik rysuje CSS przed treścią - klik w treść ma zostać zwykłym klikiem.
  if (offsetX > 26) return false;
  item.dataset.done = item.dataset.done === "true" ? "false" : "true";
  return true;
}

/**
 * Treść pola podzielona kursorem - do wstawiania zdjęcia w miejscu, w którym
 * się stoi. Oddaje HTML sprzed i zza kursora.
 */
export function splitAtCaret(field: HTMLElement): { before: string; after: string } | null {
  const current = selection();
  if (!current) return null;
  const range = current.getRangeAt(0);
  if (!field.contains(range.startContainer)) return null;

  const before = document.createRange();
  before.selectNodeContents(field);
  before.setEnd(range.startContainer, range.startOffset);

  const after = document.createRange();
  after.selectNodeContents(field);
  after.setStart(range.endContainer, range.endOffset);

  const asHtml = (part: Range) => {
    const holder = document.createElement("div");
    holder.append(part.cloneContents());
    return holder.innerHTML;
  };

  return { before: asHtml(before), after: asHtml(after) };
}
