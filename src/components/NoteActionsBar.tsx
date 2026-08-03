"use client";

import { ActionForm } from "@/components/ActionForm";

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
  if (trashed) {
    return (
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <ActionForm action={restoreAction} label="Przywróć" compact primary>
          <input type="hidden" name="noteId" value={noteId} />
        </ActionForm>
        <ActionForm
          action={purgeAction}
          label="Skasuj na stałe"
          compact
          danger
          confirmation="Skasować notatkę na stałe? Tego nie da się cofnąć."
        >
          <input type="hidden" name="noteId" value={noteId} />
        </ActionForm>
      </div>
    );
  }

  return (
    <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
      <ActionForm
        action={favoriteAction}
        label={favorite ? "Usuń z ulubionych" : "Ulubiona"}
        compact
      >
        <input type="hidden" name="noteId" value={noteId} />
        <input type="hidden" name="favorite" value={favorite ? "0" : "1"} />
      </ActionForm>
      <ActionForm
        action={trashAction}
        label="Do kosza"
        compact
        danger
        confirmation="Wyrzucić notatkę do kosza? Możesz ją później przywrócić."
      >
        <input type="hidden" name="noteId" value={noteId} />
      </ActionForm>
    </div>
  );
}
