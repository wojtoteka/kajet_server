"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { RichText } from "@/components/RichText";
import { useWords } from "@/components/LanguageProvider";
import type { Words } from "@/lib/i18n";
import { SaveStatus } from "@/components/SaveStatus";
import { useAutosave } from "@/components/useAutosave";
import { useSavedNote } from "@/components/useSavedNote";
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
import { attachmentUrl, cssAlign, cssFont } from "@/lib/document";
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
  splitTextBlocks,
  type TextAppearance,
  type TextBlock,
} from "@/lib/text-note";

type ActionResult = {
  error?: string;
  success?: string;
  version?: number;
  noteId?: string;
  attachment?: { name: string };
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
  /*
    Znacznik „treść zmieniła się z zewnątrz". Pola do pisania czytają z niego,
    kiedy wolno im przepisać swoją zawartość od nowa - w trakcie pisania nie
    wolno nigdy, bo kursor uciekłby na początek notatki.
  */
  const [revision, setRevision] = useState(0);
  const [font, setFont] = useState(appearance?.font ?? "body");
  const [fontSize, setFontSize] = useState(appearance?.fontSize ?? 0);
  const [align, setAlign] = useState(appearance?.align ?? "left");
  const shownSize = fontSize > 0 ? fontSize : TEXT_DEFAULT_SIZE;

  // Co jest włączone pod kursorem - pasek podświetla wtedy swoje przyciski.
  const [formats, setFormats] = useState<Formats>(NO_FORMATS);
  const refreshFormats = () => setFormats(activeFormats());

  // Autozapis jak w aplikacji: notatka zapisuje się sama po pauzie w pisaniu.
  // Nowa też - pierwszy zapis ją zakłada, gdy tylko jest co zapisać.
  const formRef = useRef<HTMLFormElement | null>(null);
  const saved = useSavedNote({ noteId, version, state });
  const autosaves = Boolean(saved.noteId) || body.trim().length > 0;
  const { dirty, markSent } = useAutosave({
    formRef,
    enabled: autosaves,
    auto: autoSave,
    busy,
    save: (data) => startTransition(() => submit(data)),
  });

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

  function markButton(mark: MarkName, label: string, icon: string) {
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

  function blockButton(block: BlockName, label: string, icon: string) {
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
      {/* Powodzenie zapisu pokazuje napis przy przycisku - zielona ramka nad
          notatką przeskakiwałaby przy każdym autozapisie. Błąd zostaje tutaj,
          bo trzeba go przeczytać. */}
      {state.error ? <p className="error">{state.error}</p> : null}

      {saved.noteId ? <input type="hidden" name="noteId" value={saved.noteId} /> : null}
      {saved.version != null ? (
        <input type="hidden" name="baseVersion" value={String(saved.version)} />
      ) : null}
      <input type="hidden" name="font" value={font} />
      <input type="hidden" name="fontSize" value={String(fontSize)} />
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
          maxLength={300}
          placeholder="Bez nazwy"
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

        {markButton("bold", words.bold, "format_bold")}
        {markButton("italic", words.italic, "format_italic")}
        {markButton("strike", words.strike, "format_strikethrough")}
        {markButton("underline", words.underline, "format_underlined")}
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
          title="Tabela"
          aria-label="Tabela"
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
          title="Linia"
          aria-label="Linia"
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
                {words.locale === "en-GB" ? entry.labelEn : entry.label}
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
              const value = Number(event.target.value);
              if (Number.isFinite(value)) setFontSize(value);
            }}
            style={{ width: 64, minHeight: 36, padding: "4px 8px" }}
          />
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
            title="Zdejmij kolor - tekst wraca do barwy kartki"
            onMouseDown={keepCaret}
            onClick={() => paint("")}
          >
            <Icon name="format_color_reset" size={18} />
            Bez koloru
          </button>
          <button type="button" className="compact" onClick={() => setColourBar(false)}>
            <Icon name="close" size={18} />
            Zwiń
          </button>
        </div>
      ) : null}

      {linkBar ? (
        <div className="editor-toolbar" style={{ marginTop: 6 }}>
          <label className="small" htmlFor="link-url" style={{ margin: 0 }}>
            Adres odnośnika
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
            Wstaw
          </button>
          <button type="button" className="compact" onClick={() => setLinkBar(false)}>
            Anuluj
          </button>
        </div>
      ) : null}

      {/* Notatka w kawałkach: tekst do pisania i zdjęcia widoczne jako zdjęcia.
          Wszystko w jednej ramce, żeby czytało się jak jedna kartka. */}
      <div className="note-blocks" style={{ marginTop: 10, marginBottom: 14 }}>
        {blocks.map((block, index) =>
          block.kind === "text" ? (
            <RichText
              key={index}
              label={words.noteContent}
              markdown={block.text}
              revision={revision}
              placeholder={onlyBlock ? "Pisz tutaj..." : undefined}
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
                // „Gruba czcionka" z ustawień konta. Dotyczy pisania na
                // stronie, więc do treści notatki nic z niej nie wchodzi.
                fontWeight: bold ? 700 : undefined,
                lineHeight: 1.5,
                textAlign: cssAlign(align),
                minHeight: onlyBlock ? 300 : 44,
              }}
            />
          ) : (
            <figure key={index} className="note-block-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  block.target.startsWith("assets/")
                    ? attachmentUrl(saved.noteId ?? "", block.target.slice("assets/".length))
                    : block.target
                }
                alt={block.alt || words.photoInNote}
                style={{
                  width: block.width < IMAGE_FULL_WIDTH ? `${block.width}%` : undefined,
                }}
              />
              <figcaption>
                {/* Rozmiar zdjęcia zapisuje się w treści notatki, więc taki sam
                    wjeżdża do podglądu i do odnośnika do udostępnienia. */}
                <button
                  type="button"
                  className="compact icon-only"
                  title={words.shrinkPhoto}
                  aria-label={words.shrinkPhoto}
                  disabled={block.width <= IMAGE_SMALLEST_WIDTH}
                  onClick={() => resizeImage(index, -IMAGE_WIDTH_STEP)}
                >
                  <Icon name="zoom_out" />
                </button>
                <span className="small" style={{ minWidth: 44, textAlign: "center" }}>
                  {block.width}%
                </span>
                <button
                  type="button"
                  className="compact icon-only"
                  title={words.growPhoto}
                  aria-label={words.growPhoto}
                  disabled={block.width >= IMAGE_FULL_WIDTH}
                  onClick={() => resizeImage(index, IMAGE_WIDTH_STEP)}
                >
                  <Icon name="zoom_in" />
                </button>
                <span className="small" style={{ flex: 1 }}>
                  {block.target.startsWith("assets/")
                    ? block.target.slice("assets/".length)
                    : block.target}
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
              </figcaption>
            </figure>
          ),
        )}
      </div>

      <p className="small" style={{ marginTop: -6, marginBottom: 14 }}>
        Wygląd widać od razu w trakcie pisania - notatka zapisuje się i tak
        w zapisie, który czyta tablet. Ctrl+B, Ctrl+I i Ctrl+U też działają.{" "}
        {autoSave
          ? words.autosaveHint
          : words.autosaveOffHint}{" "}
        Przy rozbieżności wersji dostaniesz komunikat zamiast nadpisać cudzą zmianę.{" "}
        {body.length.toLocaleString("pl-PL")} znaków.
      </p>

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
