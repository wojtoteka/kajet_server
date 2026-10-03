"use client";

import {
  headingInBlock,
  headingLevelsIn,
  htmlToMarkdown,
  plainTextToPasteHtml,
} from "@/lib/rich-text";

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

  // Nagłówek to wygląd tekstu, nie całego akapitu - patrz toggleHeading.
  if (block === "h1" || block === "h2" || block === "h3") {
    toggleHeading(Number(block[1]) as 1 | 2 | 3);
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

/*
  --- Nagłówek jak w Wordzie ---

  H1-H3 to wygląd nadany tekstowi, a nie całemu akapitowi - tak samo jak
  w aplikacji:
   - zaznaczenie: nagłówek dostaje zaznaczony kawałek (cały akapit w jednym
     poziomie staje się zwykłym <h1>, kawałek - <span class="h1">),
   - kursor w środku słowa: to słowo,
   - kursor w pustym akapicie: akapit staje się nagłówkiem,
   - kursor za tekstem: nagłówkiem będzie to, co się zaraz napisze.
  Ten sam przycisk na tym, co już ma ten poziom, go zdejmuje.
*/

const HEADING_SPAN = "span.h1, span.h2, span.h3";

/** Blok, którego treść to sam tekst w wierszu - akapit, nagłówek, pozycja listy bez podlisty. */
function isTextBlock(element: Element): boolean {
  return (
    element.matches("p, div, h1, h2, h3, h4, h5, h6, li, blockquote") &&
    !element.querySelector(BLOCK_INSIDE)
  );
}

/** Tekst węzła tak, jak liczy go model treści - bez znaku zerowej szerokości. */
function shownText(node: Node): string {
  return (node.textContent ?? "").replace(/\u200b/g, "");
}

/** Ile znaków tekstu stoi w [root] przed miejscem (node, offset). */
function textOffset(root: Node, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  try {
    range.setEnd(node, offset);
  } catch {
    return 0;
  }
  return range.toString().replace(/\u200b/g, "").length;
}

/** Miejsce w drzewie pola dla [at] znaków tekstu od początku [root]. */
function pointAt(root: Node, at: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let left = at;
  let last: Text | null = null;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    last = text;
    let count = 0;
    for (let i = 0; i < text.length; i += 1) {
      if (left === 0 && text.data[i] !== "\u200b") return { node: text, offset: i };
      if (text.data[i] !== "\u200b") {
        count += 1;
        left -= 1;
      }
    }
    if (left === 0 && count > 0) return { node: text, offset: text.length };
  }
  return last ? { node: last, offset: last.length } : { node: root, offset: root.childNodes.length };
}

function selectText(root: Node, from: number, to: number): void {
  const start = pointAt(root, from);
  const end = from === to ? start : pointAt(root, to);
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  const current = window.getSelection();
  current?.removeAllRanges();
  current?.addRange(range);
}

/**
 * Podmienia blok na nowy znacznik z nową treścią - wprost w drzewie strony.
 *
 * Tu świadomie NIE idziemy przez execCommand: Chrome przy `insertHTML`
 * zamienia `<span class="h1">` na `<span style="font-size:...">` (dopasowuje
 * wygląd zamiast przenieść znacznik), a blok wstawiony w miejsce bloku potrafi
 * zagnieździć `<p>` w `<h1>`. Sprawdzone w Chromium. Ctrl+Z tej jednej zmiany
 * nie cofnie, ale zapis notatki wychodzi dokładnie taki, jak trzeba.
 */
function replaceBlock(host: HTMLElement, tag: string, html: string): void {
  const fresh = document.createElement(tag);
  for (const attribute of Array.from(host.attributes)) fresh.setAttribute(attribute.name, attribute.value);
  fresh.innerHTML = html || "<br>";
  if (fresh.outerHTML === host.outerHTML) return;
  host.replaceWith(fresh);
}

/** Bloki z tekstem, których dotyka zakres [from, to) - z ich miejscem w polu. */
function textBlocksIn(field: HTMLElement, from: number, to: number) {
  const found: { block: HTMLElement; start: number; end: number }[] = [];
  for (const element of Array.from(field.querySelectorAll("*"))) {
    if (!(element instanceof HTMLElement) || !isTextBlock(element)) continue;
    const start = textOffset(field, element, 0);
    const end = start + shownText(element).length;
    if (end > from && start < to) found.push({ block: element, start, end });
    // Pusty blok pod samym kursorem też się liczy.
    else if (from === to && start === from && end === start) found.push({ block: element, start, end });
  }
  return found;
}

function headingLevelOf(element: Element): number | null {
  const match = /^H([1-6])$/.exec(element.tagName) ?? /(?:^|\s)h([1-6])(?:\s|$)/.exec(element.className);
  return match ? Math.min(3, Number(match[1])) : null;
}

/** Poziom nagłówka w miejscu kursora: najbliższy nagłówek nad nim. */
function headingAt(node: Node | null | undefined): number | null {
  const element = closest(node, (candidate) => /^H[1-6]$/.test(candidate.tagName) || candidate.matches(HEADING_SPAN));
  return element ? headingLevelOf(element) : null;
}

/** Nadaje albo zdejmuje nagłówek znaków pola od [from] do [to]. */
function headingOnText(field: HTMLElement, from: number, to: number, level: number): void {
  const blocks = textBlocksIn(field, from, to);
  const levels = blocks.flatMap(({ block, start }) =>
    headingLevelsIn(block.innerHTML, block.tagName, Math.max(from, start) - start, Math.min(to, start + shownText(block).length) - start),
  );
  const remove = levels.length > 0 && levels.every((each) => each === level);
  for (const { block, start, end } of blocks) {
    const out = headingInBlock(
      block.innerHTML,
      block.tagName,
      Math.max(from, start) - start,
      Math.min(to, end) - start,
      remove ? null : level,
    );
    replaceBlock(block, out.tag, out.html);
  }
}

const WORD_SIGN = /[\p{L}\p{N}]/u;

/** Słowo, w którego ŚRODKU stoi kursor ([at] w tekście pola); null na brzegu słowa. */
function wordAround(field: HTMLElement, at: number): { from: number; to: number } | null {
  const block = textBlocksIn(field, at, at + 1)[0] ?? textBlocksIn(field, at - 1, at)[0];
  if (!block) return null;
  const text = shownText(block.block);
  const local = at - block.start;
  if (local <= 0 || local >= text.length) return null;
  if (!WORD_SIGN.test(text[local - 1]) || !WORD_SIGN.test(text[local])) return null;
  let from = local;
  while (from > 0 && WORD_SIGN.test(text[from - 1])) from -= 1;
  let to = local;
  while (to < text.length && WORD_SIGN.test(text[to])) to += 1;
  return { from: block.start + from, to: block.start + to };
}

/**
 * Kursor za tekstem: nagłówkiem ma być to, co się napisze. Kursor staje
 * w świeżym <span class="h1"> - znak zerowej szerokości trzyma go w środku,
 * a zapis notatki go pomija. Ten sam poziom drugi raz wyprowadza kursor
 * z nagłówka, żeby dalej pisać zwykłym tekstem.
 */
function headingWhileTyping(level: number): void {
  const current = selection();
  if (!current) return;
  const anchor = current.anchorNode;
  const inside = closest(anchor, (element) => element.matches(HEADING_SPAN));
  if (headingAt(anchor) === level && inside) {
    const outside = document.createTextNode("\u200b");
    inside.after(outside);
    const range = document.createRange();
    range.setStart(outside, 1);
    range.collapse(true);
    current.removeAllRanges();
    current.addRange(range);
    return;
  }
  if (headingAt(anchor) === level) return;
  // Wprost, nie przez insertHTML - patrz replaceBlock.
  const span = document.createElement("span");
  span.className = `h${level}`;
  const text = document.createTextNode("\u200b");
  span.append(text);
  const range = current.getRangeAt(0);
  range.insertNode(span);
  range.setStart(text, 1);
  range.collapse(true);
  current.removeAllRanges();
  current.addRange(range);
}

export function toggleHeading(level: 1 | 2 | 3): void {
  const current = selection();
  if (!current) return;
  const range = current.getRangeAt(0);
  const field = fieldOf(range.commonAncestorContainer);
  if (!field) return;

  const from = textOffset(field, range.startContainer, range.startOffset);
  const to = textOffset(field, range.endContainer, range.endOffset);

  if (to > from) {
    headingOnText(field, from, to, level);
    selectText(field, from, to);
    return;
  }

  // Pusty akapit: od razu staje się nagłówkiem, jak w Wordzie.
  const host = blockAbove(range.startContainer);
  if (host && isTextBlock(host) && !shownText(host).trim()) {
    const inside = /^H[1-6]$/.test(host.tagName) && headingLevelOf(host) === level;
    run("formatBlock", inside ? "<p>" : `<h${level}>`);
    return;
  }

  const word = wordAround(field, from);
  if (word) {
    headingOnText(field, word.from, word.to, level);
    selectText(field, from, from);
    return;
  }
  headingWhileTyping(level);
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

export type ParagraphSide = "left" | "center" | "right";

export type Formats = {
  marks: Set<MarkName>;
  blocks: Set<BlockName>;
  /** Ułożenie akapitu pod kursorem. */
  align: ParagraphSide;
};

const JUSTIFY: Record<ParagraphSide, string> = {
  left: "justifyLeft",
  center: "justifyCenter",
  right: "justifyRight",
};

/**
 * Ułożenie akapitów pod kursorem albo w zaznaczeniu - tylko ich, jak
 * w Wordzie, a nie całej notatki. Idzie przez execCommand, więc cofanie
 * działa; do treści wraca jako `<p style="text-align:...">` (rich-text.ts).
 */
export function alignParagraphs(side: ParagraphSide): void {
  run(JUSTIFY[side]);
}

const ALIGNED_BLOCK = /^(P|DIV|H1|H2|H3|H4|H5|H6|LI|BLOCKQUOTE)$/;

/** Ułożenie akapitu, w którym stoi kursor. */
function alignAtCursor(anchor: Node | null | undefined): ParagraphSide {
  let current = closest(anchor, (element) => ALIGNED_BLOCK.test(element.tagName));
  while (current) {
    const value = (current.style.textAlign || current.getAttribute("align") || "").toLowerCase();
    if (value === "center") return "center";
    if (value === "right" || value === "end") return "right";
    if (value === "left" || value === "start") return "left";
    current = closest(current.parentNode, (element) => ALIGNED_BLOCK.test(element.tagName));
  }
  return "left";
}

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

  for (const tag of ["blockquote", "pre"] as const) {
    if (closestTag(anchor, tag)) blocks.add(tag);
  }
  // Nagłówek świeci po najbliższym nagłówku nad kursorem - bloku albo
  // kawałka zdania (<span class="h2">).
  const heading = headingAt(anchor);
  if (heading === 1 || heading === 2 || heading === 3) blocks.add(`h${heading}` as BlockName);

  const list = closest(anchor, (element) => element.tagName === "UL" || element.tagName === "OL");
  if (list) {
    if (list.dataset.kind === "task") blocks.add("task");
    else blocks.add(list.tagName === "OL" ? "ol" : "ul");
  }

  return { marks, blocks, align: alignAtCursor(anchor) };
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
