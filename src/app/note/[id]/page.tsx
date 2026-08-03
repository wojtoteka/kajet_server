import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { humanSize } from "@/lib/quota";
import { settings, mailWorks } from "@/lib/settings";
import { shareUrl, ownerAccess } from "@/lib/sharing";
import { textMarkdownFromContent } from "@/lib/text-note";
import { KajetMark } from "@/components/KajetMark";
import { NotePreview } from "@/components/NotePreview";
import { TextNoteEditor } from "@/components/TextNoteEditor";
import { ActionForm } from "@/components/ActionForm";
import { CopyableLink } from "@/components/CopyableLink";
import { revokeShare, share, saveTextNote } from "./actions";

const KIND_NAMES: Record<string, string> = {
  HANDWRITTEN: "Notatka odręczna",
  TEXT: "Notatka tekstowa",
  MINDMAP: "Mapa myśli",
  CODE: "Plik z kodem",
};

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await ownerAccess(id);

  if (!access.ok) {
    // We do not reveal whether the note exists. Otherwise it would be possible
    // to guess other people's identifiers from the difference in the answer.
    notFound();
  }

  const note = access.access.note;
  const shares = await prisma.share.findMany({
    where: { noteId: id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="page wide">
      <KajetMark />

      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">{KIND_NAMES[note.kind] ?? note.kind}</p>
          <h1 style={{ marginBottom: 4 }}>{note.title || "Bez nazwy"}</h1>
          <p className="small" style={{ margin: 0 }}>
            Zmieniona {note.updatedAt.toLocaleString("pl-PL")} · wersja {note.version} ·{" "}
            {humanSize(note.sizeBytes)}
          </p>
        </div>
        <Link className="button compact" href="/library">
          Wróć do listy
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 24 }}>
        {note.kind === "TEXT" ? (
          <section>
            <p className="eyebrow" style={{ marginBottom: 10 }}>
              Edycja
            </p>
            <TextNoteEditor
              action={saveTextNote}
              noteId={note.id}
              version={note.version}
              title={note.title}
              markdown={textMarkdownFromContent(note.content)}
              submitLabel="Zapisz"
            />
            <details style={{ marginTop: 20 }}>
              <summary className="small" style={{ cursor: "pointer" }}>
                Podgląd sformatowany
              </summary>
              <div style={{ marginTop: 12 }}>
                <NotePreview content={note.content} noteId={note.id} />
              </div>
            </details>
          </section>
        ) : (
          <section>
            {note.kind === "HANDWRITTEN" || note.kind === "MINDMAP" ? (
              <p className="small" style={{ marginBottom: 12 }}>
                Notatki odręczne i mapy myśli na stronie są tylko do odczytu. Poprawisz je na
                tablecie.
              </p>
            ) : null}
            <NotePreview content={note.content} noteId={note.id} />
          </section>
        )}

        <section className="sheet-ruled" style={{ paddingBlock: 24, paddingInlineEnd: 26 }}>
          <p className="eyebrow">Udostępnianie</p>
          <h2 style={{ marginBottom: 8 }}>Udostępnij tę notatkę</h2>
          <p className="lead">
            Odnośnik działa dla każdego, kto go dostanie, także bez konta. Udostępnienie na adres
            e-mail działa imiennie: otworzy je tylko osoba zalogowana tym adresem.
          </p>

          <ActionForm action={share} label="Udostępnij" busyLabel="Przygotowuję..." primary>
            <input type="hidden" name="noteId" value={note.id} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                gap: 16,
                marginBottom: 14,
              }}
            >
              <div>
                <label htmlFor="permission">Co wolno drugiej osobie</label>
                <select id="permission" name="permission" defaultValue="READ">
                  <option value="READ">Tylko czytać</option>
                  <option value="EDIT">Czytać i poprawiać</option>
                </select>
              </div>

              <div>
                <label htmlFor="email">Adres e-mail (możesz zostawić pusty)</label>
                <input id="email" name="email" type="email" placeholder="albo sam odnośnik" />
                {!mailWorks() ? (
                  <p className="small" style={{ marginTop: 4 }}>
                    Poczta nie jest ustawiona, więc wiadomość nie wyjdzie. Odnośnik skopiujesz
                    z listy niżej.
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="validDays">Ważne przez (dni)</label>
                <input id="validDays" name="validDays" type="number" min={0} defaultValue={0} />
                <p className="small" style={{ marginTop: 4 }}>Zero oznacza bez terminu.</p>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <input
                type="checkbox"
                name="anonymousAllowed"
                defaultChecked
                style={{ width: "auto" }}
              />
              <span>Pozwól otworzyć bez zakładania konta</span>
            </label>
          </ActionForm>

          {shares.length > 0 ? (
            <>
              <hr className="divider" />
              <p className="eyebrow">Już udostępnione</p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Komu</th>
                      <th style={{ width: 120 }}>Prawa</th>
                      <th style={{ width: 140 }}>Ważne do</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {shares.map((entry) => {
                      const expired = Boolean(entry.expiresAt && entry.expiresAt < new Date());
                      return (
                        <tr key={entry.id}>
                          <td>
                            {entry.email ? (
                              <>
                                <strong>{entry.email}</strong>
                                <p className="small" style={{ margin: "2px 0 0 0" }}>
                                  imiennie, wymaga zalogowania
                                </p>
                              </>
                            ) : (
                              <>
                                <span className="tag">odnośnik</span>
                                {!expired ? (
                                  <CopyableLink url={shareUrl(settings.baseUrl, entry.token)} />
                                ) : null}
                              </>
                            )}
                          </td>
                          <td>
                            <span
                              className={entry.permission === "EDIT" ? "tag accent" : "tag"}
                            >
                              {entry.permission === "EDIT" ? "poprawianie" : "czytanie"}
                            </span>
                          </td>
                          <td className="small">
                            {entry.expiresAt
                              ? `${entry.expiresAt.toLocaleDateString("pl-PL")}${expired ? " (minęło)" : ""}`
                              : "bez terminu"}
                            {entry.lastUsedAt ? (
                              <p style={{ margin: "2px 0 0 0" }}>
                                otwarte {entry.lastUsedAt.toLocaleDateString("pl-PL")}
                              </p>
                            ) : null}
                          </td>
                          <td>
                            <ActionForm
                              action={revokeShare}
                              label="Cofnij"
                              compact
                              danger
                              confirmation="Cofnąć to udostępnienie? Odnośnik przestanie działać."
                            >
                              <input type="hidden" name="id" value={entry.id} />
                            </ActionForm>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
