"use client";

import { useEffect, useRef } from "react";
import { htmlToMarkdown, markdownToHtml } from "@/lib/rich-text";
import {
  ensureWritableEnd,
  insertPlainText,
  leaveBlock,
  leaveBlockOnArrowDown,
  leaveBlockOnEnter,
  prepareEditing,
  tabInTable,
  toggleTaskAt,
} from "@/components/rich-commands";

/*
  Pole do pisania z gotowym wyglądem.

  Treść notatki dalej jest markdownem - to on idzie na serwer i na tablet. Tu
  natomiast widać od razu efekt: pogrubione jest grube, nagłówek jest duży,
  a lista ma kropki. Żadnych „**" na ekranie.

  Rzecz, o którą rozbija się każde takie pole: React NIE MOŻE przerysowywać
  jego wnętrza w trakcie pisania. Gdyby przy każdym znaku wstawiał świeży HTML,
  kursor skakałby na początek. Dlatego pole jest „bezpańskie": treść wpisujemy
  do niego RĘCZNIE i tylko wtedy, gdy zmieni ją coś z zewnątrz (wstawione
  zdjęcie, otwarcie innej notatki) - o czym mówi `revision`.
*/

export function RichText({
  markdown,
  revision,
  placeholder,
  label,
  style,
  onChange,
  onFocus,
  onSelect,
  onBlur,
  register,
}: {
  /** Treść w markdownie. Czytana przy pierwszym rysowaniu i przy zmianie `revision`. */
  markdown: string;
  /** Zmiana tej wartości znaczy „treść przyszła z zewnątrz, wpisz ją od nowa". */
  revision: number;
  placeholder?: string;
  label: string;
  style?: React.CSSProperties;
  /** Oddaje treść po każdej zmianie - już jako markdown. */
  onChange: (markdown: string) => void;
  onFocus?: () => void;
  /** Zmiana zaznaczenia albo kursora - pasek odświeża wtedy podświetlenia. */
  onSelect?: () => void;
  onBlur?: () => void;
  /** Daje edytorowi dostęp do pola (wstawianie zdjęcia, ustawianie kursora). */
  register?: (node: HTMLDivElement | null) => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const written = useRef<string | null>(null);

  useEffect(() => {
    prepareEditing();
  }, []);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const html = markdownToHtml(markdown);
    // Ta sama treść? Nie ruszamy pola - przepisanie zabrałoby kursor.
    if (written.current === html) return;
    written.current = html;
    node.innerHTML = html;
    // Notatka kończąca się blokiem kodu wraca jako HTML kończący się na `<pre>`.
    // Bez akapitu pod nim nie ma gdzie postawić kursora, więc pisanie dalej
    // przestaje istnieć zaraz po otwarciu notatki.
    if (ensureWritableEnd(node)) written.current = node.innerHTML;
    // Zależność jest umyślnie tylko od `revision`: treść w trakcie pisania
    // płynie w drugą stronę (z pola do notatki), a nie z powrotem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  function readOut(node: HTMLDivElement) {
    written.current = node.innerHTML;
    onChange(htmlToMarkdown(node.innerHTML));
  }

  return (
    <div
      ref={(node) => {
        box.current = node;
        register?.(node);
      }}
      // Pusta notatka pokazuje podpowiedź „Pisz tutaj..." - w edytowalnym polu
      // nie da się tego zrobić samym CSS-em, bo pusty akapit to wciąż treść.
      className={markdown.trim() ? "rich-text" : "rich-text empty"}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      data-rich-text="1"
      data-placeholder={placeholder}
      spellCheck
      style={style}
      onInput={(event) => readOut(event.currentTarget)}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyUp={onSelect}
      onMouseUp={onSelect}
      onPaste={(event) => {
        // Wklejamy sam tekst. Cudze style (z Worda, ze strony) przyniosłyby
        // do notatki znaczniki, których i tak nie umiemy zapisać.
        event.preventDefault();
        insertPlainText(event.clipboardData.getData("text/plain"));
        readOut(event.currentTarget);
      }}
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          if (tabInTable(event.shiftKey)) {
            event.preventDefault();
            onSelect?.();
          }
          return;
        }

        /*
          Wyjście z bloku kodu i z cytatu. Enter w kodzie musi zostać nowym
          wierszem, więc wyprowadza dopiero Enter na pustym wierszu - tak jak
          w edytorach kodu. Ctrl albo Cmd z Enterem wyprowadza z każdego
          miejsca, a strzałka w dół z ostatniego bloku notatki zakłada pod nim
          akapit, bo inaczej nie ma dokąd zjechać.
        */
        if (event.key === "Enter") {
          const left = event.ctrlKey || event.metaKey ? leaveBlock() : leaveBlockOnEnter();
          if (left) {
            event.preventDefault();
            readOut(event.currentTarget);
            onSelect?.();
          }
          return;
        }

        if (event.key === "ArrowDown" && leaveBlockOnArrowDown()) {
          event.preventDefault();
          readOut(event.currentTarget);
          onSelect?.();
        }
      }}
      onClick={(event) => {
        // Kliknięcie w kwadracik przy zadaniu odhacza je i z powrotem.
        if (toggleTaskAt(event.target, event.nativeEvent.offsetX)) {
          readOut(event.currentTarget);
        }
        onSelect?.();
      }}
    />
  );
}
