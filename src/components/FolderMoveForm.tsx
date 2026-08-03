"use client";

import { ActionForm } from "@/components/ActionForm";

type Result = { error?: string; success?: string };
type Action = (previous: Result, data: FormData) => Promise<Result>;

export function FolderMoveForm({
  noteId,
  folderId,
  folders,
  action,
}: {
  noteId: string;
  folderId: string | null;
  folders: { id: string; name: string }[];
  action: Action;
}) {
  if (folders.length === 0) return null;

  return (
    <ActionForm action={action} label="Przenieś" compact>
      <input type="hidden" name="noteId" value={noteId} />
      <div className="field" style={{ marginBottom: 6 }}>
        <select
          name="folderId"
          defaultValue={folderId ?? "__none"}
          aria-label="Folder"
          style={{ fontSize: 12 }}
        >
          <option value="__none">Bez folderu</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      </div>
    </ActionForm>
  );
}
