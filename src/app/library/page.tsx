import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { humanSize, quotaState } from "@/lib/quota";
import { KajetMark } from "@/components/KajetMark";

export const metadata = { title: "Moje notatki — Kajet" };

const KIND_NAMES: Record<string, string> = {
  HANDWRITTEN: "Notatka odręczna",
  TEXT: "Notatka tekstowa",
  MINDMAP: "Mapa myśli",
  CODE: "Plik z kodem",
};

export default async function LibraryPage() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/library");

  const [notes, storage] = await Promise.all([
    prisma.note.findMany({
      where: { ownerId: user.id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        kind: true,
        favorite: true,
        sizeBytes: true,
        updatedAt: true,
        version: true,
        _count: { select: { attachments: true, shares: true } },
      },
      take: 200,
    }),
    quotaState(user.id),
  ]);

  const percent =
    storage.unlimited || storage.quota === 0n
      ? 0
      : Math.min(100, Math.round((Number(storage.used) / Number(storage.quota)) * 100));

  return (
    <main className="page wide">
      <KajetMark caption={user.login} />

      <div className="row-spread" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Moje notatki</h1>
          <p className="small" style={{ margin: 0 }}>
            {notes.length === 0
              ? "Nic tu jeszcze nie ma."
              : `${notes.length} notatek (tablet i strona).`}
          </p>
        </div>

        <div style={{ minWidth: 240 }}>
          <p className="small" style={{ margin: "0 0 4px 0" }}>
            {humanSize(storage.used)} z{" "}
            {storage.unlimited ? "bez limitu" : humanSize(storage.quota)}
            {storage.quotaUntil
              ? ` (do ${storage.quotaUntil.toLocaleDateString("pl-PL")})`
              : ""}
          </p>
          <div className={`storage-bar${percent >= 90 ? " full" : ""}`}>
            <span style={{ width: `${storage.unlimited ? 4 : percent}%` }} />
          </div>
        </div>

        <div className="row">
          <Link className="button compact primary" href="/note/new">
            Nowa notatka tekstowa
          </Link>
          <Link className="button compact" href="/account">
            Moje konto
          </Link>
          {user.role === "ADMIN" ? (
            <Link className="button compact" href="/admin">
              Panel administratora
            </Link>
          ) : null}
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="sheet-ruled" style={{ paddingBlock: 28, paddingInlineEnd: 26 }}>
          <p className="eyebrow">Pusto</p>
          <h2 style={{ marginBottom: 8 }}>Jeszcze nic tu nie ma</h2>
          <p className="lead" style={{ margin: "0 0 16px 0", maxWidth: 520 }}>
            Zaloguj się w aplikacji na tablecie tym samym adresem, a notatki zaczną się tu
            pojawiać — albo napisz pierwszą notatkę tekstową od razu na komputerze.
          </p>
          <Link className="button primary" href="/note/new">
            Napisz notatkę tekstową
          </Link>
        </div>
      ) : (
        <div className="sheet table-scroll">
          <table>
            <thead>
              <tr>
                <th>Notatka</th>
                <th style={{ width: 160 }}>Rodzaj</th>
                <th style={{ width: 120 }}>Rozmiar</th>
                <th style={{ width: 180 }}>Ostatnia zmiana</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id}>
                  <td>
                    <Link href={`/note/${note.id}`}>
                      <strong>{note.title || "Bez nazwy"}</strong>
                    </Link>
                    {note.favorite ? (
                      <span className="tag accent" style={{ marginLeft: 8 }}>
                        ulubiona
                      </span>
                    ) : null}
                    {note._count.shares > 0 ? (
                      <span className="tag" style={{ marginLeft: 8 }}>
                        udostępniona
                      </span>
                    ) : null}
                    {note._count.attachments > 0 ? (
                      <p className="small" style={{ margin: "4px 0 0 0" }}>
                        {note._count.attachments} załączników
                      </p>
                    ) : null}
                  </td>
                  <td className="small">{KIND_NAMES[note.kind] ?? note.kind}</td>
                  <td className="small">{humanSize(note.sizeBytes)}</td>
                  <td className="small">
                    {note.updatedAt.toLocaleString("pl-PL")}
                    <br />
                    wersja {note.version}
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
