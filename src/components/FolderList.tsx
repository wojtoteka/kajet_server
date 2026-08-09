"use client";

import { useState } from "react";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import {
  FOLDER_COLOURS,
  FOLDER_ICONS,
  folderIcon,
  folderTint,
  lookLabel,
} from "@/lib/folder-look";
import { useWords } from "@/components/LanguageProvider";
import { folderDeleteWarning, folderSettingsLabel } from "@/lib/i18n";

type Result = { error?: string; success?: string };
type Action = (previous: Result, data: FormData) => Promise<Result>;

export type FolderEntry = {
  id: string;
  name: string;
  colorId: string;
  iconId: string;
  count: number;
};

export function FolderList({
  folders,
  current,
  favorites,
  favoriteCount,
  createAction,
  renameAction,
  lookAction,
  deleteAction,
}: {
  folders: FolderEntry[];
  /** "" = wszystkie, "__none" = bez folderu, inaczej identyfikator folderu. */
  current: string;
  /** Czy stoimy w Ulubionych - one są osobnym miejscem, nie filtrem. */
  favorites: boolean;
  favoriteCount: number;
  createAction: Action;
  renameAction: Action;
  lookAction: Action;
  deleteAction: Action;
}) {
  const words = useWords();
  // Folder, przy którym otwarto ustawienia wyglądu i nazwy.
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <p className="eyebrow">{words.folders}</p>

      <ul className="folder-list">
        <li>
          <Link
            className={`folder-row${current === "" && !favorites ? " here" : ""}`}
            href="/library"
          >
            <Icon name="inbox" className="folder-mark" />
            <span className="folder-name">{words.allNotes}</span>
          </Link>
        </li>
        {/*
          Ulubione stoją tu jak zwykły folder - tak samo jak zakładka w
          aplikacji. Wcześniej były tylko okienkiem do zaznaczenia w filtrach,
          więc na komputerze wyglądały na ustawienie, a nie na miejsce.
        */}
        <li>
          <Link
            className={`folder-row${favorites ? " here" : ""}`}
            href="/library?favorites=1"
          >
            <Icon name="star" className="folder-mark star" filled />
            <span className="folder-name">{words.favorites}</span>
            {favoriteCount > 0 ? (
              <span className="folder-count">{favoriteCount}</span>
            ) : null}
          </Link>
        </li>
        <li>
          <Link
            className={`folder-row${current === "__none" && !favorites ? " here" : ""}`}
            href="/library?folder=__none"
          >
            <Icon name="folder_off" className="folder-mark" />
            <span className="folder-name">{words.noFolder}</span>
          </Link>
        </li>

        {folders.map((folder) => (
          <li key={folder.id}>
            <div className="folder-line">
              <Link
                className={`folder-row${current === folder.id && !favorites ? " here" : ""}`}
                href={`/library?folder=${folder.id}`}
                style={folderTint(folder.colorId)}
              >
                <Icon
                  name={folderIcon(folder.iconId)}
                  className="folder-mark tinted"
                  filled
                />
                <span className="folder-name">{folder.name}</span>
                <span className="folder-count">{folder.count}</span>
              </Link>
              <button
                type="button"
                className={`button compact icon-only${editing === folder.id ? " on" : ""}`}
                title={folderSettingsLabel(words, folder.name)}
                aria-label={folderSettingsLabel(words, folder.name)}
                aria-expanded={editing === folder.id}
                onClick={() =>
                  setEditing((open) => (open === folder.id ? null : folder.id))
                }
              >
                <Icon name="more_vert" />
              </button>
            </div>

            {editing === folder.id ? (
              <div className="folder-editor">
                <ActionForm action={renameAction} label={words.rename} icon="edit" compact>
                  <input type="hidden" name="folderId" value={folder.id} />
                  <div className="field" style={{ marginBottom: 8 }}>
                    <input
                      name="name"
                      type="text"
                      defaultValue={folder.name}
                      maxLength={120}
                      aria-label={words.folderName}
                    />
                  </div>
                </ActionForm>

                <LookForm
                  action={lookAction}
                  folderId={folder.id}
                  colorId={folder.colorId}
                  iconId={folder.iconId}
                />

                <ActionForm
                  action={deleteAction}
                  label={words.deleteFolder}
                  icon="delete"
                  compact
                  danger
                  confirmation={folderDeleteWarning(words, folder.name, folder.count)}
                >
                  <input type="hidden" name="folderId" value={folder.id} />
                </ActionForm>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="folder-editor" style={{ marginTop: 6 }}>
          <NewFolderForm action={createAction} />
          <button type="button" className="compact" onClick={() => setAdding(false)}>
            <Icon name="close" size={18} />
            {words.collapse}
          </button>
        </div>
      ) : (
        <button type="button" className="compact" onClick={() => setAdding(true)}>
          <Icon name="create_new_folder" size={18} />
          {words.newFolder}
        </button>
      )}
    </>
  );
}

function NewFolderForm({ action }: { action: Action }) {
  const words = useWords();
  const [colour, setColour] = useState("grafit");
  const [icon, setIcon] = useState("folder");

  return (
    <ActionForm action={action} label={words.createFolderButton} icon="create_new_folder" compact>
      <div className="field" style={{ marginBottom: 8 }}>
        <input name="name" type="text" placeholder={words.folderName} required maxLength={120} />
      </div>
      <LookFields
        colour={colour}
        icon={icon}
        onColour={setColour}
        onIcon={setIcon}
      />
    </ActionForm>
  );
}

function LookForm({
  action,
  folderId,
  colorId,
  iconId,
}: {
  action: Action;
  folderId: string;
  colorId: string;
  iconId: string;
}) {
  const words = useWords();
  const [colour, setColour] = useState(colorId);
  const [icon, setIcon] = useState(iconId);

  return (
    <ActionForm action={action} label={words.saveLook} icon="palette" compact>
      <input type="hidden" name="folderId" value={folderId} />
      <LookFields colour={colour} icon={icon} onColour={setColour} onIcon={setIcon} />
    </ActionForm>
  );
}

/** Barwy i ikona - te same, które rozumie aplikacja na tablecie. */
function LookFields({
  colour,
  icon,
  onColour,
  onIcon,
}: {
  colour: string;
  icon: string;
  onColour: (id: string) => void;
  onIcon: (id: string) => void;
}) {
  const words = useWords();
  const english = words.locale === "en-GB";
  return (
    <>
      <input type="hidden" name="colorId" value={colour} />
      <input type="hidden" name="iconId" value={icon} />

      <div className="folder-swatches" role="group" aria-label={words.folderColourGroup}>
        {FOLDER_COLOURS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`ink-swatch${colour === entry.id ? " active" : ""}`}
            title={lookLabel(entry, english)}
            aria-label={lookLabel(entry, english)}
            aria-pressed={colour === entry.id}
            onClick={() => onColour(entry.id)}
            // Barwa idzie zmienną, nie wprost: ciemna kartka bierze wtedy
            // jaśniejszy odcień, ten sam co znaczek folderu i aplikacja.
            style={folderTint(entry.id)}
          />
        ))}
      </div>

      <div
        className="row"
        style={{ gap: 8, marginBottom: 8, marginTop: 8 }}
      >
        <span className="folder-mark tinted" style={folderTint(colour)}>
          <Icon name={folderIcon(icon)} filled />
        </span>
        <select
          aria-label={words.folderIconGroup}
          value={icon}
          onChange={(event) => onIcon(event.target.value)}
          style={{ fontSize: 12, minHeight: 36, padding: "4px 30px 4px 8px" }}
        >
          {FOLDER_ICONS.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {lookLabel(entry, english)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
