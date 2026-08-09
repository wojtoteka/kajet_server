"use client";

import { ActionForm } from "@/components/ActionForm";
import { useWords } from "@/components/LanguageProvider";

type Result = { error?: string; success?: string };
type Action = (previous: Result, data: FormData) => Promise<Result>;

export function NoteActionsBar({
  noteId,
  favorite,
  trashed,
  trashAction,
  restoreAction,
  purgeAction,
  favoriteAction,
}: {
  noteId: string;
  favorite: boolean;
  trashed?: boolean;
  trashAction: Action;
  restoreAction: Action;
  purgeAction: Action;
  favoriteAction: Action;
}) {
  const words = useWords();
  if (trashed) {
    return (
      <div className="row-actions">
        <ActionForm action={restoreAction} label={words.restore} icon="restore" compact primary quiet>
          <input type="hidden" name="noteId" value={noteId} />
        </ActionForm>
        <ActionForm
          action={purgeAction}
          label={words.deleteForGood}
          icon="delete_forever"
          compact
          danger
          quiet
          confirmation={words.confirmPurgeNote}
        >
          <input type="hidden" name="noteId" value={noteId} />
        </ActionForm>
      </div>
    );
  }

  /*
    Odpowiedzi („Dodano do ulubionych.") idą w cichym trybie: wiszą pod
    przyciskiem zamiast wchodzić w układ. Wcześniej ramka komunikatu rozpychała
    cały rząd i przyciski uciekały spod kursora.
  */
  return (
    <div className="row-actions">
      <ActionForm
        action={favoriteAction}
        label={favorite ? words.removeFromFavorites : words.addToFavorites}
        icon="star"
        iconOnly
        on={favorite}
        compact
        quiet
      >
        <input type="hidden" name="noteId" value={noteId} />
        <input type="hidden" name="favorite" value={favorite ? "0" : "1"} />
      </ActionForm>
      <ActionForm
        action={trashAction}
        label={words.moveToTrash}
        icon="delete"
        iconOnly
        compact
        danger
        quiet
        confirmation={words.confirmTrashNote}
      >
        <input type="hidden" name="noteId" value={noteId} />
      </ActionForm>
    </div>
  );
}
