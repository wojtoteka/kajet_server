"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon, type IconName } from "@/components/Icon";
import { RichText } from "@/components/RichText";
import { useWords } from "@/components/LanguageProvider";
import { noteTally, type Words } from "@/lib/i18n";
import { tally } from "@/lib/text-tally";
import { SaveStatus } from "@/components/SaveStatus";
import { useAutosave } from "@/components/useAutosave";
import { useSavedNote } from "@/components/useSavedNote";
import { useNoteFlush } from "@/components/NoteSync";
import { TITLE_LIMIT } from "@/lib/note-title";
import {
  activeFormats,
  applyColour,
  applyLink,
  clearColour,
  colourAtCursor,
  focusEnd,
  insertMath,
  insertRule,
  insertTable,
  linkAtCursor,
  restoreRange,
  saveRange,
  splitAtCaret,
  toggleBlock,
  toggleMark,
  type BlockName,
  type Formats,
  type MarkName,
} from "@/components/rich-commands";
import {
  argbFromHex,
  attachmentUrl,
  cssAlign,
  cssFont,
  displayInkColor,
  hexFromArgb,
} from "@/lib/document";
import { htmlToMarkdown, normaliseColour } from "@/lib/rich-text";
import {
  IMAGE_FULL_WIDTH,
  IMAGE_SMALLEST_WIDTH,
  IMAGE_WIDTH_STEP,
  TEXT_DEFAULT_SIZE,
  TEXT_FONTS,
  TEXT_LARGEST_SIZE,
  TEXT_SMALLEST_SIZE,
  clampImageWidth,
  joinTextBlocks,
  persistFontSize,
  sideBySideWidths,
  splitTextBlocks,
  textBlockRows,
  type ImageAlign,
  type TextAppearance,
  type TextBlock,
} from "@/lib/text-note";

/** Blok ze zdjęciem - wyjęty z TextBlock, żeby nie powtarzać jego kształtu. */
type PhotoBlock = Extract<TextBlock, { kind: "image" }>;

/** Odstęp między zdjęciami stojącymi obok siebie, w procentach szerokości. */
const PHOTO_GAP_SHARE = 2;

type ActionResult = {
  error?: string;
  success?: string;
  version?: number;
  noteId?: string;
  attachment?: { name: string };
  /** Tytuł podpowiedziany przez serwer z pierwszego wiersza treści. */
  title?: string;
};
type Action = (previous: ActionResult, data: FormData) => Promise<ActionResult>;

const NO_FORMATS: Formats = { marks: new Set(), blocks: new Set() };

/*
  Barwy pisma pod ręką. To ten sam zestaw, który ma pasek pisaków w aplikacji
  (InkPalette w core/design/Colors.kt), żeby notatka pisana na tablecie i na
  stronie wyglądała tak samo. Kto chce innej barwy, bierze ją z kółka obok.
*/
function textColours(words: Words): { label: string; colour: string }[] {
  return [
    { label: words.inkColour, colour: "#23211d" },
    { label: words.greyColour, colour: "#6f6a5e" },
    { label: words.blueColour, colour: "#1b4f8c" },
    { label: words.redColour, colour: "#b0322a" },
    { label: words.greenColour, colour: "#1f6b3a" },
    { label: words.brownColour, colour: "#6b4a22" },
  ];
}

export function TextNoteEditor({
  action,
  uploadAction,
  noteId,
  version,
  title,
  markdown,
  appearance,
  autoSave = true,
  bold = false,
  submitLabel,
  token,
}: {
  action: Action;
  /** Wysyłka zdjęcia do notatki - ta sama akcja co w „Pliki przy notatce". */
  uploadAction?: Action;
  noteId?: string;
  version?: number;
  title: string;
  markdown: string;
  appearance?: TextAppearance;
  /** Ustawienie konta: notatka zapisuje się sama po pauzie w pisaniu. */
  autoSave?: boolean;
  /** Ustawienie konta: grube pismo w polu do pisania. */
  bold?: boolean;
  submitLabel: string;
  /** Odnośnik do udostępnienia - zdjęcia idą wtedy jego trasą, nie właściciela. */
  token?: string;
}) {
  const words = useWords();
  const [state, submit, busy] = useActionState<ActionResult, FormData>(action, {});
  const [noteTitle, setNoteTitle] = useState(title);
  /*
    Jeden tryb: pisanie - i od razu w gotowym wyglądzie. Pogrubienie jest grube,
    nagłówek duży, lista ma kropki; żadnych „**" na ekranie. Treść notatki dalej
    jest markdownem (tak czyta ją tablet) - przekład w obie strony robi
    lib/rich-text.ts, a pole do pisania siedzi w RichText.tsx.

    Notatka stoi w kawałkach, tak jak w aplikacji: zdjęcia są zdjęciami już
    w trakcie pisania, a nie zapisem ![](assets/...).
  */
  const [blocks, setBlocks] = useState<TextBlock[]>(() => splitTextBlocks(markdown));
  const body = useMemo(() => joinTextBlocks(blocks), [blocks]);
  // Licznik rośnie w trakcie pisania, a liczy to, co widać na kartce - bez
  // gwiazdek pogrubienia, znaczników barwy i zapisu zdjęć.
  const counted = useMemo(() => tally(body), [body]);
  /*
    Znacznik „treść zmieniła się z zewnątrz". Pola do pisania czytają z niego,
    kiedy wolno im przepisać swoją zawartość od nowa - w trakcie pisania nie
    wolno nigdy, bo kursor uciekłby na początek notatki.
  */
  const [revision, setRevision] = useState(0);
  const [font, setFont] = useState(appearance?.font ?? "body");
  const [fontSize, setFontSize] = useState(appearance?.fontSize ?? 0);
  // Barwa pisma całej notatki - ta sama liczba ARGB, którą tablet trzyma
  // w content.json (0 = barwa domyślna).
  const [textColor, setTextColor] = useState(appearance?.textColor ?? 0);
  const [align, setAlign] = useState(appearance?.align ?? "left");
  const shownSize = fontSize > 0 ? fontSize : TEXT_DEFAULT_SIZE;

  // Co jest włączone pod kursorem - pasek podświetla wtedy swoje przyciski.
  const [formats, setFormats] = useState<Formats>(NO_FORMATS);
  const refreshFormats = () => setFormats(activeFormats());

  // Autozapis jak w aplikacji: notatka zapisuje się sama po pauzie w pisaniu.
  // Nowa też - pierwszy zapis ją zakłada, gdy tylko jest co zapisać.
  const formRef = useRef<HTMLFormElement | null>(null);
  const saved = useSavedNote({ noteId, version, state });

  /*
    Tytuł podpowiedziany przez serwer wpisujemy do pola - ale TYLKO wtedy, gdy
    pole jest jeszcze puste. Inaczej podpowiedź liczyłaby się od nowa przy
    każdym autozapisie i rosła razem z pierwszym wierszem notatki, aż do
    granicy obcięcia. Warunek pilnuje też tego, żeby nie nadpisać tytułu,
    który człowiek zaczął właśnie wpisywać.
  */
  useEffect(() => {
    if (!state.title) return;
    setNoteTitle((current) => (current.trim() === "" ? state.title! : current));
  }, [state]);
  const autosaves = Boolean(saved.noteId) || body.trim().length > 0;
  const { dirty, markSent } = useAutosave({
    formRef,
    enabled: autosaves,
    auto: autoSave,
    busy,
    save: (data) => startTransition(() => submit(data)),
  });

  /*
    Zapis na żądanie asystenta. Nie idzie przez `flush` z autozapisu, bo tamten
    odmawia w dwóch sytuacjach, które są tu najważniejsze: gdy nic się nie
    zmieniło i gdy notatki jeszcze nie ma. KajetAI czyta notatkę z bazy, więc
    musi ona tam być - także wtedy, gdy powstała przed chwilą i jest pusta.
    `autosave=1` zostawia człowieka na tej samej stronie, bez przekierowania.
  */
  const saveForAssistant = useCallback((): boolean => {
    const form = formRef.current;
    if (!form) return false;
    // Zapis już leci - jego odpowiedź i tak przyjdzie, nie ma po co wysyłać dwóch.
    if (busy) return true;
    markSent();
    const data = new FormData(form);
    data.set("autosave", "1");
    startTransition(() => submit(data));
    return true;
  }, [busy, markSent, submit]);
  useNoteFlush(saveForAssistant);

  /*
    Zapis przyciskiem idzie tą samą drogą co autozapis. Gdyby szedł przez
    action={...} formularza, React po każdym zapisie czyściłby pola formularza
    i zabierał kursor - i właśnie po tym zapisana notatka wyglądała na
    zablokowaną do pisania.
  */
  function saveNow() {
    const form = formRef.current;
    if (!form || busy) return;
    markSent();
    startTransition(() => submit(new FormData(form)));
  }

  /*
    Pola do pisania - po jednym na blok tekstu. Trzymamy je pod numerem bloku,
    żeby pasek narzędzi wiedział, w którym z nich stoi kursor.
  */
  const fields = useRef(new Map<number, HTMLDivElement>());
  const focused = useRef(0);

  /** Numer bloku, w którym stoi kursor. Bez kliknięcia - ostatni do pisania. */
  function writingBlock(): number {
    if (blocks[focused.current]?.kind === "text") return focused.current;
    for (let i = blocks.length - 1; i >= 0; i -= 1) {
      if (blocks[i].kind === "text") return i;
    }
    return 0;
  }

  function setBlockText(index: number, text: string) {
    setBlocks((current) =>
      current.map((block, i) => (i === index && block.kind === "text" ? { ...block, text } : block)),
    );
  }

  /**
   * Polecenie z paska. Najpierw upewnia się, że kursor stoi w polu do pisania
   * (kliknięcie w przycisk go nie zabiera - przyciski trzymają go u siebie),
   * potem wykonuje polecenie i odczytuje z pola nową treść notatki.
   */
  function command(action: () => void) {
    const index = writingBlock();
    const field = fields.current.get(index);
    if (!field) return;
    if (!field.contains(document.getSelection()?.anchorNode ?? null)) focusEnd(field);
    action();
    setBlockText(index, htmlToMarkdown(field.innerHTML));
    refreshFormats();
  }

  /*
    Wpisany z ręki zapis `![zdjęcie](assets/...)` ma się zamienić w zdjęcie -
    ale dopiero po wyjściu z pola. Gdyby blok rozpadał się w trakcie pisania,
    kursor uciekałby w środku wiersza.
  */
  function reflow() {
    const next = splitTextBlocks(joinTextBlocks(blocks));
    if (next.length === blocks.length) return;
    setBlocks(next);
    setRevision((count) => count + 1);
  }

  function removeBlock(index: number) {
    // Po wyjęciu zdjęcia sąsiednie kawałki tekstu mają się zejść w jeden -
    // dlatego składamy treść i dzielimy ją od nowa.
    setBlocks(splitTextBlocks(joinTextBlocks(blocks.filter((_, i) => i !== index))));
    setRevision((count) => count + 1);
  }

  /** Zdjęcie większe albo mniejsze - szerokość idzie do treści notatki. */
  function resizeImage(index: number, by: number) {
    setBlocks((current) =>
      current.map((block, i) =>
        i === index && block.kind === "image"
          ? { ...block, width: clampImageWidth(block.width + by) }
          : block,
      ),
    );
  }

  /** Numery bloków jednego wiersza - zdjęcia obok siebie idą razem. */
  function rowOf(index: number): number[] {
    return textBlockRows(blocks).find((row) => row.includes(index)) ?? [index];
  }

  /**
   * Zdjęcie wchodzi obok poprzedniego. Ułożenie ma cały wiersz, więc bierze
   * je od sąsiada, obok którego staje.
   */
  function standBeside(index: number) {
    setBlocks((current) => {
      const block = current[index];
      const before = current[index - 1];
      if (block?.kind !== "image" || before?.kind !== "image") return current;
      return current.map((other, i) =>
        i === index && other.kind === "image"
          ? { ...other, beside: true, align: before.align }
          : other,
      );
    });
  }

  /**
   * Zdjęcie schodzi do własnego wiersza.
   *
   * Zdjęcie stojące obok poprzedniego po prostu z wiersza wychodzi. Kiedy to
   * ono wiersz zaczyna, wychodzi to, co stoi za nim - inaczej pierwszego
   * zdjęcia w wierszu nie dałoby się odsunąć od reszty.
   */
  function ownLine(index: number) {
    setBlocks((current) => {
      const block = current[index];
      if (block?.kind !== "image") return current;
      const at = block.beside ? index : index + 1;
      const target = current[at];
      if (target?.kind !== "image" || !target.beside) return current;
      return current.map((other, i) =>
        i === at && other.kind === "image" ? { ...other, beside: false } : other,
      );
    });
  }

  /** Ułożenie CAŁEGO wiersza, w którym stoi to zdjęcie. */
  function setRowAlign(index: number, align: ImageAlign) {
    const row = rowOf(index);
    setBlocks((current) =>
      current.map((block, i) =>
        row.includes(i) && block.kind === "image" ? { ...block, align } : block,
      ),
    );
  }

  /*
    Odnośnik. Adres wpisuje się w pasku pod narzędziami - wpisanie go zabiera
    kursor z notatki, więc zaznaczenie chowamy na bok i przywracamy przed
    wstawieniem.
  */
  const [linkBar, setLinkBar] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const linkRange = useRef<Range | null>(null);
  const linkInput = useRef<HTMLInputElement | null>(null);

  function openLinkBar() {
    const index = writingBlock();
    const field = fields.current.get(index);
    if (!field) return;
    if (!field.contains(document.getSelection()?.anchorNode ?? null)) focusEnd(field);
    linkRange.current = saveRange();
    setLinkUrl(linkAtCursor() || "https://");
    setLinkBar(true);
    requestAnimationFrame(() => linkInput.current?.select());
  }

  function confirmLink() {
    const index = writingBlock();
    const field = fields.current.get(index);
    if (field) {
      field.focus();
      restoreRange(linkRange.current);
      applyLink(linkUrl);
      setBlockText(index, htmlToMarkdown(field.innerHTML));
    }
    setLinkBar(false);
  }

  /*
    Barwa pisma dla zaznaczonego kawałka - jednego słowa, jednego zdania.
    Otwiera się pod paskiem, tak samo jak adres odnośnika, i z tego samego
    powodu: kliknięcie w barwę zabiera kursor z notatki, więc zaznaczenie
    chowamy na bok i przywracamy tuż przed pokolorowaniem.
  */
  const [colourBar, setColourBar] = useState(false);
  const [colour, setColour] = useState("#23211d");
  const colourRange = useRef<Range | null>(null);

  function openColourBar() {
    const index = writingBlock();
    const field = fields.current.get(index);
    if (!field) return;
    if (!field.contains(document.getSelection()?.anchorNode ?? null)) focusEnd(field);
    colourRange.current = saveRange();
    // Przeglądarka oddaje barwę jako „rgb(...)", a kółko wyboru rozumie tylko
    // zapis po kratce.
    const under = normaliseColour(colourAtCursor());
    if (under) setColour(under);
    setColourBar(true);
  }

  /** Pusty zapis znaczy „bez barwy" - tekst wraca do koloru kartki. */
  function paint(value: string) {
    const index = writingBlock();
    const field = fields.current.get(index);
    if (field) {
      field.focus();
      restoreRange(colourRange.current);
      if (value) applyColour(value);
      else clearColour();
      setBlockText(index, htmlToMarkdown(field.innerHTML));
      // Kawałek zostaje zaznaczony, więc następna barwa trafi w to samo
      // miejsce - można przebierać, aż będzie dobrze.
      colourRange.current = saveRange();
    }
    refreshFormats();
  }

  /*
    Zdjęcie w notatce - tak samo jak w aplikacji, gdzie pasek ma „Wstaw zdjęcie
    z galerii". Plik leci tą samą drogą co załączniki, a do treści wchodzi
    odnośnik `assets/<nazwa>`; podgląd i aplikacja czytają dokładnie taki zapis.

    Wysyłka nie może iść przez własny formularz, bo formularza nie wolno włożyć
    w formularz - dlatego pole na plik jest bez nazwy (nie trafia do zapisu
    notatki), a akcję wołamy z ręcznie złożonym FormData.
  */
  const [uploadState, uploadSubmit, uploading] = useActionState<ActionResult, FormData>(
    uploadAction ?? (async () => ({})),
    {},
  );
  const fileRef = useRef<HTMLInputElement | null>(null);
  const handledUpload = useRef<ActionResult | null>(null);

  useEffect(() => {
    const name = uploadState.attachment?.name;
    if (!name) return;
    if (handledUpload.current === uploadState) return;
    handledUpload.current = uploadState;
    insertImage(name);
  }, [uploadState]);

  /** Wstawia zdjęcie osobnym blokiem, w miejscu kursora. */
  function insertImage(name: string) {
    const index = writingBlock();
    const field = fields.current.get(index);
    const image: TextBlock = {
      kind: "image",
      alt: words.photoAlt,
      target: `assets/${name}`,
      width: IMAGE_FULL_WIDTH,
      align: "left",
      beside: false,
    };
    // Kursor dzieli blok na to, co nad zdjęciem, i to, co pod nim.
    const parts = field ? splitAtCaret(field) : null;

    if (!parts || blocks[index]?.kind !== "text") {
      setBlocks([...blocks, image, { kind: "text", text: "" }]);
      setRevision((count) => count + 1);
      requestAnimationFrame(() => focusBlock(blocks.length + 1));
      return;
    }

    const next = [...blocks];
    next.splice(
      index,
      1,
      { kind: "text", text: htmlToMarkdown(parts.before) },
      image,
      { kind: "text", text: htmlToMarkdown(parts.after) },
    );
    setBlocks(next);
    setRevision((count) => count + 1);
    // Kursor ląduje pod wstawionym zdjęciem, żeby dało się pisać dalej.
    requestAnimationFrame(() => focusBlock(index + 2));
  }

  function focusBlock(index: number) {
    const field = fields.current.get(index);
    if (field) focusEnd(field);
  }

  function onPickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Czyścimy od razu, żeby wybranie tego samego pliku drugi raz też zadziałało.
    event.target.value = "";
    if (!file || !saved.noteId) return;
    const data = new FormData();
    data.set("noteId", saved.noteId);
    data.set("file", file);
    data.set("name", file.name);
    startTransition(() => uploadSubmit(data));
  }

  const onlyBlock = blocks.length === 1;

  /*
    Przyciski paska nie mogą zabierać kursora z notatki - inaczej polecenie nie
    miałoby czego pogrubić. Wystarczy nie dać przeglądarce przenieść skupienia
    na przycisk (mousedown), a zaznaczenie zostaje na miejscu.
  */
  const keepCaret = (event: React.MouseEvent) => event.preventDefault();

  function markButton(mark: MarkName, label: string, icon: IconName) {
    const on = formats.marks.has(mark);
    return (
      <button
        key={mark}
        type="button"
        className={`compact icon-only${on ? " on" : ""}`}
        title={label}
        aria-label={label}
        aria-pressed={on}
        onMouseDown={keepCaret}
        onClick={() => command(() => toggleMark(mark))}
      >
        <Icon name={icon} filled={on} />
      </button>
    );
  }

  function blockButton(block: BlockName, label: string, icon: IconName) {
    const on = formats.blocks.has(block);
    return (
      <button
        key={block}
        type="button"
        className={`compact icon-only${on ? " on" : ""}`}
        title={label}
        aria-label={label}
        aria-pressed={on}
        onMouseDown={keepCaret}
        onClick={() => command(() => toggleBlock(block))}
      >
        <Icon name={icon} filled={on} />
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        saveNow();
      }}
      className="sheet"
      style={{ padding: "22px 24px" }}
    >
      {saved.noteId ? <input type="hidden" name="noteId" value={saved.noteId} /> : null}
      {saved.version != null ? (
        <input type="hidden" name="baseVersion" value={String(saved.version)} />
      ) : null}
      <input type="hidden" name="font" value={font} />
      <input type="hidden" name="fontSize" value={String(fontSize)} />
      <input type="hidden" name="textColor" value={String(textColor)} />
      <input type="hidden" name="align" value={align} />
      {/* Do zapisu idzie cała treść sklejona z bloków - pola do pisania same
          nie mają nazw, bo każde z nich to tylko kawałek notatki. */}
      <input type="hidden" name="markdown" value={body} />

      <div className="field">
        <label htmlFor="title">{words.noteTitle}</label>
        <input
          id="title"
          name="title"
          type="text"
          value={noteTitle}
          onChange={(event) => setNoteTitle(event.target.value)}
          maxLength={TITLE_LIMIT}
          placeholder={words.untitled}
        />
      </div>

      {/*
        Pasek na ikonach z fonts.google.com/icons - tak samo jak w mapie myśli
        i w notatce odręcznej. Przyciski działają na zaznaczeniu i podświetlają
        się, gdy kursor stoi w takim właśnie kawałku tekstu.
      */}
      <div className="editor-toolbar" role="toolbar" aria-label={words.textLookToolbar}>
        {blockButton("h1", words.heading1, "format_h1")}
        {blockButton("h2", words.heading2, "format_h2")}
        {blockButton("h3", words.heading3, "format_h3")}

        <span className="toolbar-sep" />

        {/* Skrót przy podpisie przycisku - widać go po najechaniu, czyli
            dokładnie wtedy, gdy człowiek szuka tej właśnie rzeczy. */}
        {markButton("bold", `${words.bold} (Ctrl+B)`, "format_bold")}
        {markButton("italic", `${words.italic} (Ctrl+I)`, "format_italic")}
        {markButton("strike", words.strike, "format_strikethrough")}
        {markButton("underline", `${words.underline} (Ctrl+U)`, "format_underlined")}
        {markButton("mark", words.highlight, "ink_highlighter")}
        <button
          type="button"
          className={`compact icon-only${colourBar ? " on" : ""}`}
          title={words.textColourOfSelection}
          aria-label={words.textColourOfSelection}
          aria-pressed={colourBar}
          onMouseDown={keepCaret}
          onClick={() => (colourBar ? setColourBar(false) : openColourBar())}
        >
          <Icon name="format_color_text" />
        </button>

        <span className="toolbar-sep" />

        {blockButton("ul", words.bulletListHint, "format_list_bulleted")}
        {blockButton("ol", words.numberedListHint, "format_list_numbered")}
        {blockButton("task", words.taskListHint, "checklist")}
        {blockButton("blockquote", words.quoteWord, "format_quote")}

        <span className="toolbar-sep" />

        {markButton("code", words.codeInText, "code")}
        {blockButton("pre", words.codeBlockWord, "data_object")}
        <button
          type="button"
          className={`compact icon-only${linkBar ? " on" : ""}`}
          title={words.linkWord2}
          aria-label={words.linkWord2}
          aria-pressed={linkBar}
          onMouseDown={keepCaret}
          onClick={() => (linkBar ? setLinkBar(false) : openLinkBar())}
        >
          <Icon name="link" />
        </button>
        {uploadAction ? (
          <>
            {/* Pole na plik nie ma się pokazywać - klika się w przycisk obok.
                Samo `hidden` przegrywało z ogólnym stylem pól, więc dokładamy
                display wprost, a przy okazji brak nazwy trzyma je z dala od
                zapisu notatki. */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              style={{ display: "none" }}
              onChange={onPickImage}
            />
            <button
              type="button"
              className="compact icon-only"
              disabled={!saved.noteId || uploading}
              title={
                uploading
                  ? words.sendingPhoto
                  : saved.noteId
                    ? words.insertPhotoInNote
                    : autoSave
                      ? words.writeSomethingFirst
                      : words.saveNoteFirst
              }
              aria-label={words.insertPhotoInNote}
              onMouseDown={keepCaret}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name={uploading ? "hourglass_top" : "add_photo_alternate"} />
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="compact icon-only"
          title={words.tableWord}
          aria-label={words.tableWord}
          onMouseDown={keepCaret}
          onClick={() => command(insertTable)}
        >
          <Icon name="table_chart" />
        </button>
        <button
          type="button"
          className="compact icon-only"
          title={words.formulaWord}
          aria-label={words.formulaWord}
          onMouseDown={keepCaret}
          onClick={() => command(insertMath)}
        >
          <Icon name="functions" />
        </button>
        <button
          type="button"
          className="compact icon-only"
          title={words.dividerWord}
          aria-label={words.dividerWord}
          onMouseDown={keepCaret}
          onClick={() => command(insertRule)}
        >
          <Icon name="horizontal_rule" />
        </button>

        <span className="toolbar-sep" />

        {/* Krój i rozmiar całej notatki. Ikona zamiast podpisu, żeby pasek
            mieścił się w jednym rzędzie - co znaczy pole, mówi podpowiedź. */}
        <span
          className="toolbar-field"
          title={words.wholeNoteFont}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Icon name="text_format" size={18} />
          <select
            aria-label={words.wholeNoteFont}
            value={font}
            onChange={(event) => setFont(event.target.value)}
            style={{ width: "auto", minHeight: 36, padding: "4px 30px 4px 8px" }}
          >
            {TEXT_FONTS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {words.locale === "en-US" ? entry.labelEn : entry.label}
              </option>
            ))}
          </select>
        </span>
        <span
          className="toolbar-field"
          title={words.wholeNoteSize}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Icon name="format_size" size={18} />
          <input
            type="number"
            aria-label={words.wholeNoteSize}
            min={TEXT_SMALLEST_SIZE}
            max={TEXT_LARGEST_SIZE}
            value={shownSize}
            onChange={(event) => {
              setFontSize(persistFontSize(fontSize, Number(event.target.value)));
            }}
            style={{ width: 64, minHeight: 36, padding: "4px 8px" }}
          />
          <button
            type="button"
            className="compact"
            title={words.defaultSize}
            aria-label={words.defaultSize}
            onClick={() => setFontSize(0)}
          >
            {words.defaultSize}
          </button>
        </span>
        {/* Barwa pisma całej notatki - jak na tablecie. Kolorowanie jednego
            słowa robi się przyciskiem przy pogrubieniu, nie tutaj. */}
        <span
          className="toolbar-field"
          title={words.wholeNoteColour}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Icon name="format_color_text" size={18} />
          <input
            type="color"
            aria-label={words.wholeNoteColour}
            value={textColor !== 0 ? hexFromArgb(textColor) : "#23211d"}
            onChange={(event) => setTextColor(argbFromHex(event.target.value))}
            style={{ width: 38, minHeight: 34, padding: 2 }}
          />
          {textColor !== 0 ? (
            <button
              type="button"
              className="compact icon-only"
              title={words.defaultColour}
              aria-label={words.defaultColour}
              onClick={() => setTextColor(0)}
            >
              <Icon name="format_color_reset" size={18} />
            </button>
          ) : null}
        </span>
        {(
          [
            ["left", "format_align_left", words.alignLeft],
            ["center", "format_align_center", words.alignCentre],
            ["right", "format_align_right", words.alignRight],
          ] as const
        ).map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            className={`compact icon-only${align === id ? " on" : ""}`}
            title={label}
            aria-label={label}
            aria-pressed={align === id}
            onMouseDown={keepCaret}
            onClick={() => setAlign(id)}
          >
            <Icon name={icon} filled={align === id} />
          </button>
        ))}
      </div>

      {colourBar ? (
        <div className="editor-toolbar" style={{ marginTop: 6 }}>
          <span className="small" style={{ margin: 0 }}>
            {words.textColourOfSelection}
          </span>
          {textColours(words).map((entry) => (
            <button
              key={entry.colour}
              type="button"
              className="ink-swatch"
              title={entry.label}
              aria-label={entry.label}
              onMouseDown={keepCaret}
              onClick={() => {
                setColour(entry.colour);
                paint(entry.colour);
              }}
              style={{ background: entry.colour }}
            />
          ))}
          {/* Dowolna barwa - kółko z systemu. Ta sama droga, co przy pisakach
              w notatce odręcznej. */}
          <input
            type="color"
            aria-label={words.ownTextColour}
            title={words.ownTextColour}
            value={colour}
            onChange={(event) => {
              setColour(event.target.value);
              paint(event.target.value);
            }}
            style={{ width: 38, minHeight: 34, padding: 2 }}
          />
          <button
            type="button"
            className="compact"
            title={words.clearColourHint}
            onMouseDown={keepCaret}
            onClick={() => paint("")}
          >
            <Icon name="format_color_reset" size={18} />
            {words.noColour}
          </button>
          <button type="button" className="compact" onClick={() => setColourBar(false)}>
            <Icon name="close" size={18} />
            {words.collapse}
          </button>
        </div>
      ) : null}

      {linkBar ? (
        <div className="editor-toolbar" style={{ marginTop: 6 }}>
          <label className="small" htmlFor="link-url" style={{ margin: 0 }}>
            {words.linkAddress}
          </label>
          <input
            id="link-url"
            ref={linkInput}
            type="url"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirmLink();
              }
              if (event.key === "Escape") setLinkBar(false);
            }}
            placeholder="https://"
            style={{ flex: 1, minWidth: 200, minHeight: 36, padding: "4px 8px" }}
          />
          <button type="button" className="compact primary" onClick={confirmLink}>
            {words.insertWord}
          </button>
          <button type="button" className="compact" onClick={() => setLinkBar(false)}>
            {words.cancel}
          </button>
        </div>
      ) : null}

      {/* Notatka w kawałkach: tekst do pisania i zdjęcia widoczne jako zdjęcia.
          Wszystko w jednej ramce, żeby czytało się jak jedna kartka.

          Zdjęcia stojące w jednym wierszu treści stoją obok siebie także tutaj,
          a przyciski każdego z nich - pod całym wierszem. Pod zdjęciem
          o szerokości 25% i tak by się nie zmieściły. */}
      <div className="note-blocks" style={{ marginTop: 10, marginBottom: 14 }}>
        {textBlockRows(blocks).map((row) => {
          const first = blocks[row[0]];
          if (first.kind === "text") {
            const index = row[0];
            return (
              <RichText
                key={index}
                label={words.noteContent}
                markdown={first.text}
                revision={revision}
                placeholder={onlyBlock ? words.writeHere : undefined}
                register={(node) => {
                  if (node) fields.current.set(index, node);
                  else fields.current.delete(index);
                }}
                onChange={(text) => setBlockText(index, text)}
                onFocus={() => {
                  focused.current = index;
                  refreshFormats();
                }}
                onSelect={refreshFormats}
                onBlur={reflow}
                style={{
                  fontFamily: cssFont(font),
                  fontSize: shownSize,
                  color: textColor !== 0 ? displayInkColor(textColor) : undefined,
                  // „Gruba czcionka" z ustawień konta. Dotyczy pisania na
                  // stronie, więc do treści notatki nic z niej nie wchodzi.
                  fontWeight: bold ? 700 : undefined,
                  lineHeight: 1.5,
                  textAlign: cssAlign(align),
                  minHeight: onlyBlock ? 300 : 44,
                }}
              />
            );
          }

          const photos = row.map((index) => blocks[index] as PhotoBlock);
          const rowAlign = photos[0].align;
          /*
            Szerokość zdjęcia to ułamek szerokości notatki. Zdjęcia stojące
            obok siebie schodzą tak, żeby zmieściły się w wierszu - ale
            w notatce zostaje ta szerokość, którą ktoś wybrał.
          */
          const shown = sideBySideWidths(
            photos.map((photo) => photo.width),
            photos.length > 1 ? PHOTO_GAP_SHARE * (photos.length - 1) : 0,
          );

          return (
            <div key={row[0]}>
              <div
                className="note-photo-row"
                data-align={rowAlign === "left" ? undefined : rowAlign}
              >
                {photos.map((photo, at) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={row[at]}
                    src={
                      photo.target.startsWith("assets/")
                        ? attachmentUrl(
                            saved.noteId ?? "",
                            photo.target.slice("assets/".length),
                            token,
                          )
                        : photo.target
                    }
                    alt={photo.alt || words.photoInNote}
                    style={{
                      width:
                        shown[at] < IMAGE_FULL_WIDTH
                          ? `${Math.round(shown[at])}%`
                          : undefined,
                    }}
                  />
                ))}
              </div>

              {row.map((index, at) => {
                const photo = photos[at];
                const before = blocks[index - 1];
                const after = blocks[index + 1];
                const inRow =
                  photo.beside || (after?.kind === "image" && after.beside);
                return (
                  <div className="note-photo-bar" key={index}>
                    {/* Rozmiar zdjęcia zapisuje się w treści notatki, więc taki sam
                        wjeżdża do podglądu i do odnośnika do udostępnienia. */}
                    <button
                      type="button"
                      className="compact icon-only"
                      title={words.shrinkPhoto}
                      aria-label={words.shrinkPhoto}
                      disabled={photo.width <= IMAGE_SMALLEST_WIDTH}
                      onClick={() => resizeImage(index, -IMAGE_WIDTH_STEP)}
                    >
                      <Icon name="zoom_out" />
                    </button>
                    <span className="small" style={{ minWidth: 44, textAlign: "center" }}>
                      {photo.width}%
                    </span>
                    <button
                      type="button"
                      className="compact icon-only"
                      title={words.growPhoto}
                      aria-label={words.growPhoto}
                      disabled={photo.width >= IMAGE_FULL_WIDTH}
                      onClick={() => resizeImage(index, IMAGE_WIDTH_STEP)}
                    >
                      <Icon name="zoom_in" />
                    </button>

                    {/* Ułożenie ma cały wiersz, więc przyciski stoją raz - przy
                        pierwszym zdjęciu. */}
                    {at === 0
                      ? (
                          [
                            { side: "left", icon: "format_align_left", name: words.alignLeft },
                            {
                              side: "center",
                              icon: "format_align_center",
                              name: words.alignCentre,
                            },
                            {
                              side: "right",
                              icon: "format_align_right",
                              name: words.alignRight,
                            },
                          ] as const
                        ).map((choice) => (
                          <button
                            key={choice.side}
                            type="button"
                            className={`compact icon-only${rowAlign === choice.side ? " on" : ""}`}
                            title={`${words.photoPlacement}: ${choice.name}`}
                            aria-label={`${words.photoPlacement}: ${choice.name}`}
                            aria-pressed={rowAlign === choice.side}
                            onClick={() => setRowAlign(index, choice.side)}
                          >
                            <Icon name={choice.icon} filled={rowAlign === choice.side} />
                          </button>
                        ))
                      : null}

                    {/* Zdjęcie idzie obok tego, które stoi nad nim - i wraca do
                        swojego wiersza tym samym miejscem. Kiedy nad zdjęciem nie
                        ma zdjęcia, nie ma też obok czego stanąć. */}
                    {inRow ? (
                      <button
                        type="button"
                        className="compact"
                        onClick={() => ownLine(index)}
                      >
                        {words.photoOwnLine}
                      </button>
                    ) : before?.kind === "image" ? (
                      <button
                        type="button"
                        className="compact"
                        onClick={() => standBeside(index)}
                      >
                        {words.photoBeside}
                      </button>
                    ) : null}

                    <span className="small" style={{ flex: 1 }}>
                      {photo.target.startsWith("assets/")
                        ? photo.target.slice("assets/".length)
                        : photo.target}
                    </span>
                    <button
                      type="button"
                      className="compact icon-only"
                      title={words.removePhotoFromNote}
                      aria-label={words.removePhotoFromNote}
                      onClick={() => removeBlock(index)}
                    >
                      <Icon name="hide_image" />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/*
        Rachunek, a po nim jedno zdanie - ten sam układ co pod mapą myśli
        i pod kartką odręczną.

        Stał tu wcześniej akapit, który naraz tłumaczył wygląd w trakcie
        pisania, skróty klawiszowe, autozapis i konflikt wersji, a na końcu
        doklejał liczbę znaków kropką. Trzy z tych zdań były wpisane po polsku
        na twardo, więc po angielsku wychodziła mieszanka. Skróty siedzą teraz
        na przyciskach paska, gdzie są potrzebne, a o konflikcie wersji mówi
        komunikat wtedy, gdy konflikt naprawdę wystąpi.
      */}
      <p className="small" style={{ marginTop: -6, marginBottom: 14 }}>
        {noteTally(words, counted.words, counted.chars)} ·{" "}
        {autoSave ? words.autosaveHint : words.autosaveOffHint}
      </p>

      {/* Powodzenie zapisu pokazuje napis przy przycisku - zielona ramka nad
          notatką przeskakiwałaby przy każdym autozapisie. Pełny błąd też stoi
          tutaj, przy przycisku: na górze spychał całą notatkę w dół. */}
      {state.error ? (
        <p className="error" style={{ margin: "0 0 10px 0" }}>
          {state.error}
        </p>
      ) : null}

      <div className="save-row">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? words.savingWord : saved.noteId ? words.save : submitLabel}
        </button>
        <SaveStatus
          busy={busy}
          dirty={dirty}
          saved={saved.saved}
          autosaves={autosaves}
          autoSaveOff={!autoSave}
          error={state.error}
        />
      </div>
    </form>
  );
}
