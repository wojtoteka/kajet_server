"use client";

import { useWords } from "@/components/LanguageProvider";

/**
 * Napis „Zapisane / Zapisuję / Zmiany niezapisane" przy przycisku zapisu.
 *
 * Odpowiedź serwera po autozapisie leciała wcześniej zieloną ramką na górze
 * formularza — w długim edytorze (mapa, kartka odręczna) nikt jej tam nie
 * widział, więc autozapis wyglądał jak wyłączony i wszyscy klikali „Zapisz".
 * Tutaj stan stoi tuż obok przycisku, czyli tam, gdzie się patrzy.
 */
export function SaveStatus({
  busy,
  dirty,
  saved,
  autosaves,
  autoSaveOff = false,
  error,
}: {
  /** Zapis leci właśnie na serwer. */
  busy: boolean;
  /** Są zmiany, których serwer jeszcze nie widział. */
  dirty: boolean;
  /** Serwer potwierdził już przynajmniej jeden zapis w tej sesji. */
  saved: boolean;
  /** Autozapis jest w tej chwili włączony. */
  autosaves: boolean;
  /** Konto ma autozapis wyłączony w „Moje konto". */
  autoSaveOff?: boolean;
  /** Odpowiedź serwera, jeśli ostatni zapis się nie udał. */
  error?: string;
}) {
  const words = useWords();
  const failed = Boolean(error) && !busy && !dirty;
  const text = busy
    ? words.saving
    : dirty
      ? autoSaveOff
        ? words.unsavedPressSave
        : words.unsavedWillSave
      : failed
        ? words.saveFailed
        : saved
          ? words.saved
          : autoSaveOff
            ? words.autosaveOff
            : autosaves
              ? words.autosaveOn
              : words.willSaveWhenYouType;

  const tone = busy
    ? " working"
    : dirty
      ? " waiting"
      : failed
        ? " failed"
        : saved
          ? " done"
          : "";

  return (
    <span className={`save-state${tone}`} role="status" aria-live="polite">
      {text}
    </span>
  );
}
