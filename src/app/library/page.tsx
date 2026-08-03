import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { humanSize, quotaState } from "@/lib/quota";
import { KajetMark } from "@/components/KajetMark";
import { ActionForm } from "@/components/ActionForm";
import {
  trashNoteFromLibrary,
  toggleFavoriteFromLibrary,
  createFolder,
  moveNoteToFolder,
} from "./actions";
import { FolderMoveForm } from "@/components/FolderMoveForm";

export const metadata = { title: "Moje notatki — Kajet" };

const KIND_NAMES: Record<string, string> = {
  HANDWRITTEN: "Odręczna",
  TEXT: "Tekstowa",
  MINDMAP: "Mapa myśli",
  CODE: "Kod",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    folder?: string;
    favorites?: string;
    kind?: string;
  }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/library");

  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const folderFilter = params.folder ?? "";
  const favoritesOnly = params.favorites === "1";
  const kindFilter = params.kind ?? "";

  const where: Prisma.NoteWhereInput = {
    ownerId: user.id,
    deletedAt: null,
  };

  if (favoritesOnly) where.favorite = true;
  if (kindFilter && ["HANDWRITTEN", "TEXT", "MINDMAP", "CODE"].includes(kindFilter)) {
    where.kind = kindFilter as "HANDWRITTEN" | "TEXT" | "MINDMAP" | "CODE";
  }
  if (folderFilter === "__none") {
    where.folderId = null;
  } else if (folderFilter) {
    where.folderId = folderFilter;
  }
  if (query) {
    where.OR = [
      { title: { contains: query } },
      { tags: { contains: query } },
    ];
  }

  const [notes, storage, folders, trashCount] = await Promise.all([
    prisma.note.findMany({
      where,
      orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        kind: true,
        favorite: true,
        sizeBytes: true,
        updatedAt: true,
        version: true,
        folderId: true,
        _count: { select: { attachments: true, shares: true } },
      },
      take: 300,
    }),
    quotaState(user.id),
    prisma.folder.findMany({
      where: { ownerId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { notes: true } } },
    }),
    prisma.note.count({ where: { ownerId: user.id, deletedAt: { not: null } } }),
  ]);

  const percent =
    storage.unlimited || storage.quota === 0n
      ? 0
      : Math.min(100, Math.round((Number(storage.used) / Number(storage.quota)) * 100));

  const folderName = (id: string | null) =>
    id ? (folders.find((folder) => folder.id === id)?.name ?? "Folder") : null;

  return (
    <main className="page wide">
      <KajetMark caption={user.login} />

      <div className="row-spread" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Moje notatki</h1>
          <p className="small" style={{ margin: 0 }}>
            {notes.length === 0
              ? query || favoritesOnly || folderFilter || kindFilter
                ? "Nic nie pasuje do filtrów."
                : "Nic tu jeszcze nie ma."
              : `${notes.length} notatek`}
            {trashCount > 0 ? ` · ${trashCount} w koszu` : ""}
          </p>
        </div>

        <div style={{ minWidth: 220 }}>
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

        <div className="row" style={{ flexWrap: "wrap" }}>
          <Link className="button compact primary" href="/note/new">
            Nowa tekstowa
          </Link>
          <Link className="button compact" href="/note/new/mindmap">
            Mapa myśli
          </Link>
          <Link className="button compact" href="/note/new/handwriting">
            Odręczna
          </Link>
          <Link className="button compact" href="/note/new/code">
            Nowy kod
          </Link>
          <Link className="button compact" href="/library/trash">
            Kosz{trashCount > 0 ? ` (${trashCount})` : ""}
          </Link>
          <Link className="button compact" href="/account">
            Konto
          </Link>
          {user.role === "ADMIN" ? (
            <Link className="button compact" href="/admin">
              Admin
            </Link>
          ) : null}
        </div>
      </div>

      <section className="sheet" style={{ padding: "16px 18px", marginBottom: 16 }}>
        <form method="get" className="row" style={{ flexWrap: "wrap", gap: 10, alignItems: "end" }}>
          <div className="field" style={{ margin: 0, flex: "1 1 200px" }}>
            <label htmlFor="q">Szukaj</label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Tytuł lub tag…"
            />
          </div>
          <div className="field" style={{ margin: 0, minWidth: 160 }}>
            <label htmlFor="folder">Folder</label>
            <select id="folder" name="folder" defaultValue={folderFilter}>
              <option value="">Wszystkie</option>
              <option value="__none">Bez folderu</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name} ({folder._count.notes})
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0, minWidth: 140 }}>
            <label htmlFor="kind">Rodzaj</label>
            <select id="kind" name="kind" defaultValue={kindFilter}>
              <option value="">Wszystkie</option>
              <option value="TEXT">Tekstowe</option>
              <option value="CODE">Kod</option>
              <option value="HANDWRITTEN">Odręczne</option>
              <option value="MINDMAP">Mapy myśli</option>
            </select>
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
              fontSize: 14,
            }}
          >
            <input
              type="checkbox"
              name="favorites"
              value="1"
              defaultChecked={favoritesOnly}
              style={{ width: "auto" }}
            />
            Tylko ulubione
          </label>
          <button type="submit" className="compact">
            Filtruj
          </button>
          {query || folderFilter || favoritesOnly || kindFilter ? (
            <Link className="button compact" href="/library">
              Wyczyść
            </Link>
          ) : null}
        </form>
      </section>

      <div className="library-layout">
        <aside className="sheet" style={{ padding: "16px 18px" }}>
          <p className="eyebrow">Foldery</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px 0" }}>
            <li style={{ marginBottom: 6 }}>
              <Link
                href="/library"
                style={{
                  fontWeight: !folderFilter ? 600 : 400,
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                Wszystkie
              </Link>
            </li>
            <li style={{ marginBottom: 6 }}>
              <Link
                href="/library?folder=__none"
                style={{
                  fontWeight: folderFilter === "__none" ? 600 : 400,
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                Bez folderu
              </Link>
            </li>
            {folders.map((folder) => (
              <li key={folder.id} style={{ marginBottom: 6 }}>
                <Link
                  href={`/library?folder=${folder.id}`}
                  style={{
                    fontWeight: folderFilter === folder.id ? 600 : 400,
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  {folder.name}
                  <span className="small" style={{ marginLeft: 6 }}>
                    {folder._count.notes}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <ActionForm action={createFolder} label="Nowy folder" compact>
            <div className="field" style={{ marginBottom: 8 }}>
              <input name="name" type="text" placeholder="Nazwa folderu" required maxLength={120} />
            </div>
          </ActionForm>
        </aside>

        <div>
          {notes.length === 0 ? (
            <div className="sheet-ruled" style={{ paddingBlock: 28, paddingInlineEnd: 26 }}>
              <p className="eyebrow">Pusto</p>
              <h2 style={{ marginBottom: 8 }}>Jeszcze nic tu nie ma</h2>
              <p className="lead" style={{ margin: "0 0 16px 0", maxWidth: 520 }}>
                Napisz notatkę tekstową albo plik z kodem na komputerze — albo zsynchronizuj
                notatki z aplikacji mobilnej tym samym kontem.
              </p>
              <div className="row">
                <Link className="button primary" href="/note/new">
                  Notatka tekstowa
                </Link>
                <Link className="button" href="/note/new/code">
                  Plik z kodem
                </Link>
              </div>
            </div>
          ) : (
            <div className="sheet table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Notatka</th>
                    <th style={{ width: 110 }}>Rodzaj</th>
                    <th style={{ width: 120 }}>Folder</th>
                    <th style={{ width: 90 }}>Rozmiar</th>
                    <th style={{ width: 150 }}>Zmiana</th>
                    <th style={{ width: 160 }} />
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
                      <td className="small">{folderName(note.folderId) ?? "—"}</td>
                      <td className="small">{humanSize(note.sizeBytes)}</td>
                      <td className="small">
                        {note.updatedAt.toLocaleString("pl-PL")}
                        <br />
                        wersja {note.version}
                      </td>
                      <td>
                        <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
                          <ActionForm
                            action={toggleFavoriteFromLibrary}
                            label={note.favorite ? "★" : "☆"}
                            compact
                          >
                            <input type="hidden" name="noteId" value={note.id} />
                            <input
                              type="hidden"
                              name="favorite"
                              value={note.favorite ? "0" : "1"}
                            />
                          </ActionForm>
                          <ActionForm
                            action={trashNoteFromLibrary}
                            label="Kosz"
                            compact
                            danger
                            confirmation="Wyrzucić do kosza?"
                          >
                            <input type="hidden" name="noteId" value={note.id} />
                          </ActionForm>
                        </div>
                        {folders.length > 0 ? (
                          <div style={{ marginTop: 6 }}>
                            <FolderMoveForm
                              noteId={note.id}
                              folderId={note.folderId}
                              folders={folders}
                              action={moveNoteToFolder}
                            />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
