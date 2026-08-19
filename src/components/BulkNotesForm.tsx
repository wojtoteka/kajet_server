"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import { useWords } from "@/components/LanguageProvider";
import { selectedNotes } from "@/lib/i18n";
import type { FolderChoice } from "@/components/FolderMoveForm";

type Result = { error?: string; success?: string };
type Action = (previous: Result, data: FormData) => Promise<Result>;

/** Nazwa formularza. Zaznaczenia w tabeli wskazują go atrybutem `form`. */
export const BULK_FORM_ID = "bulk-notes";

/**
 * Pasek działań na zaznaczonych notatkach.
 *
 * Zaznaczenia stoją w komórkach tabeli, a ten formularz nad nią — HTML nie
 * pozwala zagnieżdżać formularzy, a w każdym wierszu jeden już jest (gwiazdka,
 * kosz, wybór folderu). Dlatego pola wskazują swój formularz atrybutem `form`
 * i należą do niego mimo odległości w drzewie strony. Dzięki temu spis notatek
 * zostaje zwykłym składnikiem serwerowym.
 *
 * Licznik czyta zaznaczenia prosto z formularza, a nie z własnego stanu:
 * przeglądarka i tak jest tu jedynym źródłem prawdy, a odtwarzanie jej stanu
 * w Reakcie rozjeżdżałoby się przy każdym powrocie „wstecz".
 */
export function BulkNotesForm({
  folders,
  action,
}: {
  folders: FolderChoice[];
  action: Action;
}) {
  const words = useWords();
  const [state, submit, busy] = useActionState<Result, FormData>(action, {});
  const form = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);
  const [asking, setAsking] = useState(false);
  const approved = useRef(false);

  const recount = useCallback(() => {
    const current = form.current;
    if (!current) return;
    setCount(new FormData(current).getAll("noteIds").filter(Boolean).length);
  }, []);

  const setAll = useCallback(
    (checked: boolean) => {
      const boxes = document.querySelectorAll<HTMLInputElement>(
        `input[type="checkbox"][name="noteIds"][form="${BULK_FORM_ID}"]`,
      );
      for (const box of boxes) box.checked = checked;
      recount();
    },
    [recount],
  );

  useEffect(() => {
    // Zdarzenia zaznaczeń nie dochodzą do formularza (leżą poza nim
    // w drzewie strony), więc słuchamy ich na całym dokumencie.
    document.addEventListener("change", recount);
    recount();
    return () => document.removeEventListener("change", recount);
  }, [recount]);

  /*
    Po udanym działaniu zaznaczenia schodzą.

    Wyrzucone notatki znikają ze spisu razem ze swoimi kwadracikami, ale
    przeniesione zostają — i zostawały zaznaczone, bo to zwykłe pola HTML,
    których odświeżenie strony nie rusza. Pasek mówiłby wtedy „zaznaczono 3"
    nad robotą, która się właśnie skończyła.
  */
  useEffect(() => {
    if (state.success) setAll(false);
  }, [state, setAll]);

  /*
    Pasek schodzi z ekranu, gdy nic nie wskazano. Formularz zostaje w drzewie,
    bo kwadraciki w wierszach wskazują go atrybutem `form` — bez niego
    zaznaczenie nie miałoby do kogo należeć.

    hidden=true przy zerze: klasa `.row` ustawia display:flex i przebija zwykły
    atrybut hidden, więc w arkuszu jest osobna reguła `.bulk-bar[hidden]`.
    Przy zaznaczeniu pasek jest pozycją absolutną na rzędzie narzędzi biblioteki
    (`.library-toolbar`), więc spis notatek nie jedzie w dół. Wygląd jak tamten
    rząd: te same `.button.compact`, ten sam odstęp co `.row`.
  */

  return (
    <form
      id={BULK_FORM_ID}
      ref={form}
      action={submit}
      className="row bulk-bar"
      hidden={count === 0}
      aria-label={words.bulkBarLabel}
      onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter as
          | HTMLButtonElement
          | null;
        if (submitter?.value === "trash" && !approved.current) {
          event.preventDefault();
          setAsking(true);
          return;
        }
        approved.current = false;
      }}
    >
      {asking ? (
        <ConfirmDialog
          question={words.bulkConfirmTrash}
          confirmLabel={words.moveToTrash}
          danger
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            approved.current = true;
            // requestSubmit z przyciskiem, a nie bez: bez niego formularz
            // pojechałby bez „what" i serwer nie wiedziałby, co zrobić.
            const button = form.current?.querySelector<HTMLButtonElement>(
              'button[value="trash"]',
            );
            if (button) form.current?.requestSubmit(button);
          }}
        />
      ) : null}

      <span className="bulk-count">{selectedNotes(words, count)}</span>

      <button type="button" className="button compact on" onClick={() => setAll(true)}>
        <Icon name="select_all" size={18} />
        {words.bulkSelectAll}
      </button>
      <button type="button" className="button compact" onClick={() => setAll(false)}>
        {words.bulkClear}
      </button>

      <span className="bulk-move">
        <label htmlFor="bulk-folder" className="visually-hidden">
          {words.bulkPickTarget}
        </label>
        <select
          id="bulk-folder"
          name="folderId"
          className="toolbar-select"
          defaultValue="__none"
          disabled={busy}
        >
          <option value="__none">{words.noFolder}</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          name="what"
          value="move"
          className="button compact"
          disabled={busy}
        >
          <Icon name={busy ? "hourglass_top" : "drive_file_move"} size={18} />
          {words.bulkMove}
        </button>
      </span>

      <button
        type="submit"
        name="what"
        value="trash"
        className="button compact danger"
        disabled={busy}
      >
        <Icon name={busy ? "hourglass_top" : "delete"} size={18} />
        {words.moveToTrash}
      </button>

      {state.error ? <span className="action-note bad">{state.error}</span> : null}
      {state.success ? <span className="action-note">{state.success}</span> : null}
    </form>
  );
}
