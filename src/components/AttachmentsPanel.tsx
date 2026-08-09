"use client";

import { useEffect, useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { useWords } from "@/components/LanguageProvider";
import { Icon } from "@/components/Icon";

type Result = { error?: string; success?: string };
type Action = (previous: Result, data: FormData) => Promise<Result>;

type Attachment = { name: string; mime: string; sizeBytes: number };

function isImage(file: Attachment): boolean {
  if (file.mime.startsWith("image/")) return true;
  // Załącznik wysłany bez rozpoznanego rodzaju i tak bywa zdjęciem.
  return /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name);
}

export function AttachmentsPanel({
  noteId,
  attachments,
  uploadAction,
  removeAction,
}: {
  noteId: string;
  attachments: Attachment[];
  uploadAction: Action;
  removeAction: Action;
}) {
  const words = useWords();
  // Nazwa pliku pokazywanego w podglądzie na wierzchu strony.
  const [preview, setPreview] = useState<string | null>(null);

  const address = (name: string) =>
    `/note/${noteId}/attachment?name=${encodeURIComponent(name)}`;

  useEffect(() => {
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const shown = attachments.find((file) => file.name === preview) ?? null;

  return (
    <section className="sheet" style={{ padding: "22px 24px" }}>
      <p className="eyebrow">{words.attachmentsEyebrow}</p>
      <h2 style={{ marginBottom: 8 }}>{words.filesWithNote}</h2>
      <p className="lead" style={{ marginBottom: 14 }}>
        Zdjęcia i rysunki używane w treści. Te same pliki synchronizuje aplikacja mobilna.
      </p>

      <ActionForm action={uploadAction} label={words.sendFile} busyLabel={words.sendingFile} icon="upload" compact>
        <input type="hidden" name="noteId" value={noteId} />
        <div className="field">
          <label htmlFor="attachment-file">{words.fileLabel}</label>
          <input id="attachment-file" name="file" type="file" accept="image/*,.json" required />
        </div>
        <div className="field">
          <label htmlFor="attachment-name">{words.nameInNote}</label>
          <input
            id="attachment-name"
            name="name"
            type="text"
            placeholder={words.namePlaceholder}
          />
        </div>
      </ActionForm>

      {attachments.length > 0 ? (
        <>
          <hr className="divider" />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 64 }} />
                  <th>{words.columnName}</th>
                  <th style={{ width: 140 }}>{words.columnKind}</th>
                  <th style={{ width: 100 }}>{words.columnSize}</th>
                  <th style={{ width: 150 }} />
                </tr>
              </thead>
              <tbody>
                {attachments.map((file) => {
                  const picture = isImage(file);
                  return (
                    <tr key={file.name}>
                      <td>
                        {picture ? (
                          <button
                            type="button"
                            className="thumb-button"
                            onClick={() => setPreview(file.name)}
                            title={`Podejrzyj ${file.name}`}
                            aria-label={`Podejrzyj ${file.name}`}
                          >
                            {/* Miniatura pochodzi z tej samej trasy co plik -
                                przeglądarka trzyma ją potem w pamięci. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={address(file.name)} alt="" loading="lazy" />
                          </button>
                        ) : (
                          <span className="thumb-button empty" aria-hidden="true">
                            <Icon name="draft" />
                          </span>
                        )}
                      </td>
                      <td>
                        {picture ? (
                          /*
                            Zdjęcie otwiera się na wierzchu strony. Wcześniej
                            nazwa była zwykłym odnośnikiem i klik wyrzucał
                            z edycji notatki prosto na goły plik.
                          */
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => setPreview(file.name)}
                          >
                            {file.name}
                          </button>
                        ) : (
                          <a href={address(file.name)} target="_blank" rel="noreferrer">
                            {file.name}
                          </a>
                        )}
                      </td>
                      <td className="small">{file.mime}</td>
                      <td className="small">{formatBytes(file.sizeBytes)}</td>
                      <td>
                        <div className="row-actions">
                          {picture ? (
                            <button
                              type="button"
                              className="button compact icon-only"
                              onClick={() => setPreview(file.name)}
                              title={words.previewWord}
                              aria-label={words.previewWord}
                            >
                              <Icon name="visibility" />
                            </button>
                          ) : null}
                          <a
                            className="button compact icon-only"
                            href={address(file.name)}
                            target="_blank"
                            rel="noreferrer"
                            title={words.openInNewTab}
                            aria-label={words.openInNewTab}
                          >
                            <Icon name="open_in_new" />
                          </a>
                          <ActionForm
                            action={removeAction}
                            label={words.removeAttachment}
                            icon="delete"
                            iconOnly
                            compact
                            danger
                            quiet
                            confirmation={`Usunąć załącznik „${file.name}"?`}
                          >
                            <input type="hidden" name="noteId" value={noteId} />
                            <input type="hidden" name="name" value={file.name} />
                          </ActionForm>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="small" style={{ marginTop: 12, marginBottom: 0 }}>
          Brak załączników.
        </p>
      )}

      {shown ? (
        <div
          className="preview-veil"
          role="dialog"
          aria-modal="true"
          aria-label={`Podgląd: ${shown.name}`}
          onClick={() => setPreview(null)}
        >
          <div className="preview-box" onClick={(event) => event.stopPropagation()}>
            <div className="row-spread" style={{ marginBottom: 10 }}>
              <strong style={{ wordBreak: "break-word" }}>{shown.name}</strong>
              <div className="row" style={{ gap: 6 }}>
                <a
                  className="button compact icon-only"
                  href={address(shown.name)}
                  target="_blank"
                  rel="noreferrer"
                  title={words.openInNewTab}
                  aria-label={words.openInNewTab}
                >
                  <Icon name="open_in_new" />
                </a>
                <button
                  type="button"
                  className="button compact icon-only"
                  onClick={() => setPreview(null)}
                  title={words.close}
                  aria-label={words.close}
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={address(shown.name)} alt={shown.name} />
            <p className="small" style={{ margin: "10px 0 0 0" }}>
              {shown.mime} · {formatBytes(shown.sizeBytes)} · Esc zamyka
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
