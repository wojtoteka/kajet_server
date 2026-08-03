"use client";

import { ActionForm } from "@/components/ActionForm";

type Result = { error?: string; success?: string };
type Action = (previous: Result, data: FormData) => Promise<Result>;

export function AttachmentsPanel({
  noteId,
  attachments,
  uploadAction,
  removeAction,
}: {
  noteId: string;
  attachments: { name: string; mime: string; sizeBytes: number }[];
  uploadAction: Action;
  removeAction: Action;
}) {
  return (
    <section className="sheet" style={{ padding: "22px 24px" }}>
      <p className="eyebrow">Załączniki</p>
      <h2 style={{ marginBottom: 8 }}>Pliki przy notatce</h2>
      <p className="lead" style={{ marginBottom: 14 }}>
        Zdjęcia i rysunki używane w treści. Te same pliki synchronizuje aplikacja mobilna.
      </p>

      <ActionForm action={uploadAction} label="Wyślij plik" busyLabel="Wysyłam..." compact>
        <input type="hidden" name="noteId" value={noteId} />
        <div className="field">
          <label htmlFor="attachment-file">Plik</label>
          <input id="attachment-file" name="file" type="file" accept="image/*,.json" required />
        </div>
        <div className="field">
          <label htmlFor="attachment-name">Nazwa w notatce (opcjonalnie)</label>
          <input
            id="attachment-name"
            name="name"
            type="text"
            placeholder="np. zdjecie-1.png"
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
                  <th>Nazwa</th>
                  <th style={{ width: 140 }}>Rodzaj</th>
                  <th style={{ width: 100 }}>Rozmiar</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {attachments.map((file) => (
                  <tr key={file.name}>
                    <td>
                      <a href={`/note/${noteId}/attachment?name=${encodeURIComponent(file.name)}`}>
                        {file.name}
                      </a>
                    </td>
                    <td className="small">{file.mime}</td>
                    <td className="small">{formatBytes(file.sizeBytes)}</td>
                    <td>
                      <ActionForm
                        action={removeAction}
                        label="Usuń"
                        compact
                        danger
                        confirmation={`Usunąć załącznik „${file.name}"?`}
                      >
                        <input type="hidden" name="noteId" value={noteId} />
                        <input type="hidden" name="name" value={file.name} />
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="small" style={{ marginTop: 12, marginBottom: 0 }}>
          Brak załączników.
        </p>
      )}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
