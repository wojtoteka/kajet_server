"use client";

import { useActionState, useRef } from "react";
import { Icon } from "@/components/Icon";
import { useWords } from "@/components/LanguageProvider";
import { folderIcon, folderTint } from "@/lib/folder-look";

type Result = { error?: string; success?: string };
type Action = (previous: Result, data: FormData) => Promise<Result>;

export type FolderChoice = {
  id: string;
  name: string;
  colorId: string;
  iconId: string;
};

/**
 * Folder notatki w spisie: barwny znaczek i nazwa, które dopiero po najechaniu
 * pokazują, że są do zmiany.
 *
 * Wcześniej stała tu rozwijana lista z osobnym przyciskiem „Przenieś" wciśnięta
 * do kolumny z działaniami - rozpychała ją na trzy poziomy. Teraz zmiana idzie
 * od razu po wybraniu, a kolumna „Folder" wreszcie coś pokazuje.
 */
export function FolderMoveForm({
  noteId,
  folderId,
  folders,
  action,
}: {
  noteId: string;
  folderId: string | null;
  folders: FolderChoice[];
  action: Action;
}) {
  const words = useWords();
  const [state, submit, busy] = useActionState<Result, FormData>(action, {});
  const form = useRef<HTMLFormElement>(null);

  const current = folderId ? (folders.find((entry) => entry.id === folderId) ?? null) : null;

  // Bez ani jednego folderu nie ma czego wybierać - zostaje sama kreska.
  if (folders.length === 0) return <>-</>;

  return (
    <form
      ref={form}
      action={submit}
      className="folder-pick"
      style={folderTint(current?.colorId ?? "bez")}
    >
      <input type="hidden" name="noteId" value={noteId} />

      <Icon
        name={busy ? "hourglass_top" : current ? folderIcon(current.iconId) : "folder_off"}
        size={16}
        filled={Boolean(current)}
        className={`folder-mark small${current ? " tinted" : ""}`}
      />

      <span className="folder-pick-shell">
        <select
          name="folderId"
          defaultValue={folderId ?? "__none"}
          // Czytnik ekranu ma powiedzieć, CO robi ta lista. Sam
          // „aria-label" z nazwą folderu brzmiał jak podpis, a nie jak
          // kontrolka do przenoszenia notatki.
          aria-label={words.moveNoteToFolder}
          disabled={busy}
          onChange={() => form.current?.requestSubmit()}
        >
          <option value="__none">{words.noFolder}</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
        <Icon name="expand_more" size={14} className="folder-pick-caret" />
      </span>

      {/* Zapasowe wyjście, gdy przeglądarka nie wykona skryptu: przycisk da się
          złapać klawiszem Tab, choć na oko go nie widać. */}
      <button type="submit" className="visually-hidden">
        Przenieś
      </button>

      {state.error ? <span className="action-note bad">{state.error}</span> : null}
    </form>
  );
}
