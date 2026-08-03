import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { humanSize } from "@/lib/quota";
import { KajetMark } from "@/components/KajetMark";
import { ActionForm } from "@/components/ActionForm";
import {
  restoreNoteFromTrash,
  purgeNoteFromTrash,
  emptyTrash,
} from "../actions";

export const metadata = { title: "Kosz — Kajet" };

const KIND_NAMES: Record<string, string> = {
  HANDWRITTEN: "Odręczna",
  TEXT: "Tekstowa",
  MINDMAP: "Mapa myśli",
  CODE: "Kod",
};

export default async function TrashPage() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/library/trash");

  const notes = await prisma.note.findMany({
    where: { ownerId: user.id, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    select: {
      id: true,
      title: true,
      kind: true,
      sizeBytes: true,
      deletedAt: true,
      updatedAt: true,
    },
    take: 300,
  });

  return (
    <main className="page wide">
      <KajetMark caption={user.login} />

      <div className="row-spread" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Kosz</h1>
          <p className="small" style={{ margin: 0 }}>
            Wyrzucone notatki zostają tu, dopóki ich nie przywrócisz albo nie skasujesz na stałe.
            Aplikacja mobilna zobaczy skasowanie przy następnej synchronizacji.
          </p>
        </div>
        <div className="row">
          <Link className="button compact" href="/library">
            Wróć do listy
          </Link>
          {notes.length > 0 ? (
            <ActionForm
              action={emptyTrash}
              label="Opróżnij kosz"
              compact
              danger
              confirmation="Skasować na stałe wszystkie notatki z kosza?"
            />
          ) : null}
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="sheet-ruled" style={{ paddingBlock: 28, paddingInlineEnd: 26 }}>
          <p className="eyebrow">Pusto</p>
          <h2 style={{ marginBottom: 8 }}>Kosz jest pusty</h2>
          <p className="lead" style={{ margin: 0 }}>
            Nic tu nie leży. Wyrzucone notatki pojawią się w tym miejscu.
          </p>
        </div>
      ) : (
        <div className="sheet table-scroll">
          <table>
            <thead>
              <tr>
                <th>Notatka</th>
                <th style={{ width: 120 }}>Rodzaj</th>
                <th style={{ width: 100 }}>Rozmiar</th>
                <th style={{ width: 180 }}>Wyrzucona</th>
                <th style={{ width: 200 }} />
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id}>
                  <td>
                    <strong>{note.title || "Bez nazwy"}</strong>
                  </td>
                  <td className="small">{KIND_NAMES[note.kind] ?? note.kind}</td>
                  <td className="small">{humanSize(note.sizeBytes)}</td>
                  <td className="small">
                    {(note.deletedAt ?? note.updatedAt).toLocaleString("pl-PL")}
                  </td>
                  <td>
                    <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                      <ActionForm action={restoreNoteFromTrash} label="Przywróć" compact primary>
                        <input type="hidden" name="noteId" value={note.id} />
                      </ActionForm>
                      <ActionForm
                        action={purgeNoteFromTrash}
                        label="Na stałe"
                        compact
                        danger
                        confirmation="Skasować na stałe? Tego nie da się cofnąć."
                      >
                        <input type="hidden" name="noteId" value={note.id} />
                      </ActionForm>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
