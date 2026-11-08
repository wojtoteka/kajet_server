"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useWords } from "@/components/LanguageProvider";
import { folderIcon, folderTint } from "@/lib/folder-look";
import type { NewNoteFolder } from "@/lib/new-note-folder";

/**
 * Wybór folderu przy zakładaniu notatki. Stoi w formularzu edytora, więc
 * pole `folderId` jedzie razem z PIERWSZYM zapisem (ręcznym albo autozapisem)
 * i notatka od razu powstaje w tym folderze - bez przypisywania jej potem
 * w bibliotece.
 *
 * Edytor pokazuje to pole tylko do chwili, gdy notatka trafi na serwer.
 * Później folder zmienia się w bibliotece, jak dotąd.
 */
export function NewNoteFolderField({ folders, folderId }: NewNoteFolder) {
  const words = useWords();
  const [chosen, setChosen] = useState(folderId ?? "__none");

  // Bez ani jednego folderu nie ma czego wybierać.
  if (folders.length === 0) return null;

  const current = folders.find((folder) => folder.id === chosen) ?? null;

  return (
    <div className="field">
      <label htmlFor="new-note-folder">{words.folder}</label>
      <span
        style={{
          ...folderTint(current?.colorId ?? "bez"),
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon
          name={current ? folderIcon(current.iconId) : "folder_off"}
          size={18}
          filled={Boolean(current)}
          className={`folder-mark${current ? " tinted" : ""}`}
        />
        <select
          id="new-note-folder"
          name="folderId"
          value={chosen}
          onChange={(event) => setChosen(event.target.value)}
          style={{ flex: 1 }}
        >
          <option value="__none">{words.noFolder}</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}
