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
  deleteFolder,
  renameFolder,
  setFolderLook,
  moveNoteToFolder,
  bulkNotesFromLibrary,
  uploadLibraryFile,
} from "./actions";
import { BulkNotesForm, BULK_FORM_ID } from "@/components/BulkNotesForm";
import { LibraryFileUpload } from "@/components/LibraryFileUpload";
import { FolderMoveForm } from "@/components/FolderMoveForm";
import { FolderList } from "@/components/FolderList";
import { Icon, type IconName } from "@/components/Icon";
import { currentWords } from "@/lib/language";
import {
  attachmentsCount,
  libraryFileUploadHint,
  libraryFileUploadLabel,
  libraryFileUploadingLabel,
  notesCount,
  type Words,
} from "@/lib/i18n";
import { LIBRARY_FILE_ACCEPT } from "@/lib/library-file";

export async function generateMetadata() {
  return { title: (await currentWords()).libraryTitle };
}

/** Nazwa miejsca, w którym stoimy - jak nazwa folderu na górze spisu. */
function placeName(
  words: Words,
  favoritesOnly: boolean,
  folderFilter: string,
  folders: { id: string; name: string }[],
): string {
  if (favoritesOnly) return words.favorites;
  if (folderFilter === "__none") return words.noFolder;
  if (folderFilter) {
    return folders.find((folder) => folder.id === folderFilter)?.name ?? words.folder;
  }
  return words.myNotes;
}

function kindName(words: Words, kind: string): string {
  switch (kind) {
    case "HANDWRITTEN":
      return words.handwritten;
    case "TEXT":
      return words.kindText;
    case "MINDMAP":
      return words.mindMap;
    case "CODE":
      return words.kindCode;
    default:
      return kind;
  }
}

/** Ikony rodzajów notatek - nazwy prosto z fonts.google.com/icons. */
const KIND_ICONS: Record<string, IconName> = {
  HANDWRITTEN: "draw",
  TEXT: "article",
  MINDMAP: "account_tree",
  CODE: "code",
};

/**
 * Ile notatek na jednej stronie spisu. Wcześniej spis brał sztywno 300 i nic
 * nie mówił o reszcie: przy większej bibliotece notatki po prostu znikały ze
 * strony, choć leżały na serwerze i były widoczne w aplikacji.
 */
const PAGE_SIZE = 100;

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    folder?: string;
    favorites?: string;
    kind?: string;
    page?: string;
  }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/library");

  const params = await searchParams;
  const words = await currentWords();
  const query = (params.q ?? "").trim();
  const folderFilter = params.folder ?? "";
  const favoritesOnly = params.favorites === "1";
  const kindFilter = params.kind ?? "";
  const page = Math.max(1, Math.floor(Number(params.page) || 1));

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

  const [notes, total, storage, folders, trashCount, favoriteCount, appAvailable] =
    await Promise.all([
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
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      }),
      prisma.note.count({ where }),
      quotaState(user.id),
      prisma.folder.findMany({
        where: { ownerId: user.id },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          colorId: true,
          iconId: true,
          _count: { select: { notes: true } },
        },
      }),
      prisma.note.count({ where: { ownerId: user.id, deletedAt: { not: null } } }),
      // Licznik przy „Ulubionych" w spisie folderów - z całej biblioteki,
      // niezależnie od tego, po czym akurat filtrujemy.
      prisma.note.count({
        where: { ownerId: user.id, deletedAt: null, favorite: true },
      }),
      prisma.appRelease.count({ where: { current: true } }),
    ]);

  // Jak na ekranie konta: bez ograniczeń - pusty pasek, zero miejsca - pełny.
  const percent = storage.unlimited
    ? 0
    : storage.quota <= 0n
      ? 100
      : Math.min(100, Math.round((Number(storage.used) / Number(storage.quota)) * 100));

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const here = placeName(words, favoritesOnly, folderFilter, folders);

  /** Adres tej samej biblioteki, z tymi samymi filtrami, na innej stronie. */
  function pageLink(target: number): string {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (folderFilter) search.set("folder", folderFilter);
    if (favoritesOnly) search.set("favorites", "1");
    if (kindFilter) search.set("kind", kindFilter);
    if (target > 1) search.set("page", String(target));
    const text = search.toString();
    return text ? `/library?${text}` : "/library";
  }

  // Spis do wyboru folderu przy notatce - bez licznika, za to z barwą i ikoną.
  const folderChoices = folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    colorId: folder.colorId,
    iconId: folder.iconId,
  }));

  return (
    <main className="page wide">
      <KajetMark home="/library" caption={user.login} />

      {/* Tytuł i licznik miejsca stoją w jednym rzędzie na każdej szerokości -
          układ siedzi w .library-head (globals.css), bo na telefonie wymaga
          czegoś więcej niż zawijanego rzędu. */}
      <div className="library-head">
        <div>
          <h1 style={{ marginBottom: 4 }}>
            {favoritesOnly ? words.favorites : here}
          </h1>
          <p className="small" style={{ margin: 0 }}>
            {total === 0
              ? query || folderFilter || kindFilter
                ? words.nothingMatchesFilters
                : favoritesOnly
                  ? words.noFavoritesYet
                  : words.nothingHereYet
              : notesCount(words, total)}
            {pages > 1
              ? ` · ${words.pageWord.toLowerCase()} ${Math.min(page, pages)} ${words.ofWord} ${pages}`
              : ""}
            {trashCount > 0 ? ` · ${trashCount} ${words.inTrash}` : ""}
          </p>
        </div>

        <div className="storage-note">
          <p className="small" style={{ margin: "0 0 4px 0", textAlign: "right" }}>
            {humanSize(storage.used)} {words.ofWord}{" "}
            {storage.unlimited ? words.noLimit : humanSize(storage.quota)}
            {storage.quotaUntil
              ? ` (${words.until} ${storage.quotaUntil.toLocaleDateString(words.locale)})`
              : ""}
          </p>
          <div className={`storage-bar${percent >= 90 ? " full" : ""}`}>
            <span style={{ width: `${storage.unlimited ? 4 : percent}%` }} />
          </div>
        </div>
      </div>

      {/*
        Pasek zaznaczonych nakłada się na rząd „nowa notatka / kosz / konto”,
        zamiast wchodzić nad tabelę i wypychać spis. Przy zerze jest hidden
        (zero wysokości). Formularz stoi tu, a kwadraciki w wierszach i tak
        wskazują go atrybutem form - patrz BulkNotesForm.
      */}
      <div className="row-spread library-toolbar" style={{ marginBottom: 20 }}>
        <div className="row library-actions" style={{ flexWrap: "wrap" }}>
          <Link className="button compact primary" href="/note/new">
            <Icon name="post_add" size={18} />
            {words.newText}
          </Link>
          <Link className="button compact" href="/note/new/mindmap">
            <Icon name="account_tree" size={18} />
            {words.mindMap}
          </Link>
          <Link className="button compact" href="/note/new/handwriting">
            <Icon name="draw" size={18} />
            {words.handwritten}
          </Link>
          <Link className="button compact" href="/note/new/code">
            <Icon name="code" size={18} />
            {words.newCode}
          </Link>
          <LibraryFileUpload
            action={uploadLibraryFile}
            folderId={
              folderFilter && folderFilter !== "__none" ? folderFilter : undefined
            }
            accept={LIBRARY_FILE_ACCEPT}
            label={libraryFileUploadLabel(words)}
            busyLabel={libraryFileUploadingLabel(words)}
            hint={libraryFileUploadHint(words)}
            openLabel={words.open}
            closeLabel={words.close}
          />
          <Link className="button compact" href="/library/trash">
            <Icon name="delete" size={18} />
            {words.trash}
            {trashCount > 0 ? ` (${trashCount})` : ""}
          </Link>
          <Link className="button compact" href="/account">
            <Icon name="account_circle" size={18} />
            {words.account}
          </Link>
          {appAvailable > 0 ? (
            <Link className="button compact" href="/download">
              <Icon name="install_mobile" size={18} />
              {words.app}
            </Link>
          ) : null}
          {user.role === "ADMIN" ? (
            <Link className="button compact" href="/admin">
              <Icon name="shield_person" size={18} />
              {words.admin}
            </Link>
          ) : null}
        </div>
        <BulkNotesForm folders={folderChoices} action={bulkNotesFromLibrary} />
      </div>

      <section className="sheet" style={{ padding: "16px 18px", marginBottom: 16 }}>
        {/*
          Zwijane na telefonie (sam CSS, patrz .filter-toggle w globals.css):
          karta filtrów zabierała pół ekranu, zanim było widać notatki.
          Na szerokim ekranie ta para znaczników jest niewidoczna.
        */}
        <input type="checkbox" id="filter-fold" className="filter-toggle" />
        <label htmlFor="filter-fold" className="filter-summary">
          {words.filtersLabel}
        </label>
        <form method="get" className="library-filters">
          {/*
            W Ulubionych szukanie i rodzaj mają zawężać ulubione, a nie
            wyrzucać człowieka z powrotem do całej biblioteki - dlatego
            miejsce jedzie z formularzem po cichu.
          */}
          {favoritesOnly ? <input type="hidden" name="favorites" value="1" /> : null}
          <div className="field field-search">
            <label htmlFor="q">{words.search}</label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder={words.searchPlaceholder}
            />
          </div>
          <div className="field field-folder">
            <label htmlFor="folder">{words.folder}</label>
            <select id="folder" name="folder" defaultValue={folderFilter}>
              <option value="">{words.all}</option>
              <option value="__none">{words.noFolder}</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name} ({folder._count.notes})
                </option>
              ))}
            </select>
          </div>
          <div className="field field-kind">
            <label htmlFor="kind">{words.kind}</label>
            <select id="kind" name="kind" defaultValue={kindFilter}>
              <option value="">{words.all}</option>
              <option value="TEXT">{words.kindText}</option>
              <option value="CODE">{words.kindCode}</option>
              <option value="HANDWRITTEN">{words.kindHandwritten}</option>
              <option value="MINDMAP">{words.kindMindMaps}</option>
            </select>
          </div>
          <div className="filter-actions">
            <button type="submit" className="compact primary">
              {words.filterButton}
            </button>
            {/*
              Jeden przycisk wyjścia, wszędzie ten sam: wraca do całego spisu.
              „Wyczyść" mówiło o formularzu, „Wszystkie" mówi o miejscu - tak
              samo jak wiersz na górze spisu folderów.
            */}
            {query || kindFilter || folderFilter || favoritesOnly ? (
              <Link className="button compact" href="/library">
                <Icon name="inbox" size={18} />
                {words.all}
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <div className="library-layout">
        <aside className="sheet" style={{ padding: "16px 18px" }}>
          <FolderList
            current={folderFilter}
            favorites={favoritesOnly}
            favoriteCount={favoriteCount}
            folders={folders.map((folder) => ({
              id: folder.id,
              name: folder.name,
              colorId: folder.colorId,
              iconId: folder.iconId,
              count: folder._count.notes,
            }))}
            createAction={createFolder}
            renameAction={renameFolder}
            lookAction={setFolderLook}
            deleteAction={deleteFolder}
          />
        </aside>

        <div>
          {notes.length === 0 && total > 0 ? (
            // Strona za ostatnią - na przykład po wyrzuceniu notatek do kosza
            // albo po wejściu ze starego odnośnika z numerem strony.
            <div className="sheet-ruled" style={{ paddingBlock: 28, paddingInlineEnd: 26 }}>
              <p className="eyebrow">{words.emptyPageTitle}</p>
              <h2 style={{ marginBottom: 8 }}>{words.emptyPageHeading}</h2>
              <p className="lead" style={{ margin: "0 0 16px 0", maxWidth: 520 }}>
                {notesCount(words, total)} · {words.pageWord} {page} {words.ofWord} {pages}.
              </p>
              <Link className="button primary" href={pageLink(1)}>
                {words.backToStart}
              </Link>
            </div>
          ) : notes.length === 0 && favoritesOnly ? (
            <div className="sheet-ruled" style={{ paddingBlock: 28, paddingInlineEnd: 26 }}>
              <p className="eyebrow">{words.favorites}</p>
              <h2 style={{ marginBottom: 8 }}>{words.favoritesEmptyHeading}</h2>
              <p className="lead" style={{ margin: "0 0 16px 0", maxWidth: 520 }}>
                {words.favoritesEmptyAbout}
              </p>
              <Link className="button primary" href="/library">
                <Icon name="inbox" size={18} />
                {words.all}
              </Link>
            </div>
          ) : notes.length === 0 ? (
            <div className="sheet-ruled" style={{ paddingBlock: 28, paddingInlineEnd: 26 }}>
              <p className="eyebrow">{words.emptyEyebrow}</p>
              <h2 style={{ marginBottom: 8 }}>{words.emptyHeading}</h2>
              <p className="lead" style={{ margin: "0 0 16px 0", maxWidth: 520 }}>
                {words.emptyAbout}
              </p>
              <div className="row">
                <Link className="button primary" href="/note/new">
                  <Icon name="article" size={18} />
                  {words.textNote}
                </Link>
                <Link className="button" href="/note/new/code">
                  <Icon name="code" size={18} />
                  {words.codeFile}
                </Link>
              </div>
            </div>
          ) : (
            <div className="sheet table-scroll">
              <table className="notes-table">
                <thead>
                  <tr>
                    <th>{words.columnNote}</th>
                    <th style={{ width: 120 }}>{words.columnKind}</th>
                    <th style={{ width: 170 }}>{words.columnFolder}</th>
                    <th style={{ width: 90 }}>{words.columnSize}</th>
                    <th style={{ width: 150 }}>{words.columnChanged}</th>
                    <th style={{ width: 132, textAlign: "right" }}>
                      <span className="visually-hidden">{words.columnActions}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((note) => (
                    <tr key={note.id}>
                      <td>
                        {/*
                          Zaznaczenie stoi PRZY tytule, a nie we własnej
                          kolumnie: układ kartowy na telefonie rozstawia
                          komórki po numerze kolumny, więc szósta kolumna
                          przestawiłaby całą kartę.
                        */}
                        <span className="note-pick">
                          <input
                            type="checkbox"
                            name="noteIds"
                            value={note.id}
                            form={BULK_FORM_ID}
                            aria-label={`${words.bulkRowLabel}: ${note.title || words.untitled}`}
                          />
                          <Link href={`/note/${note.id}`}>
                            <strong>{note.title || words.untitled}</strong>
                          </Link>
                        </span>
                        {note.favorite ? (
                          <span className="tag accent" style={{ marginLeft: 8 }}>
                            {words.tagFavorite}
                          </span>
                        ) : null}
                        {note._count.shares > 0 ? (
                          <span className="tag" style={{ marginLeft: 8 }}>
                            {words.tagShared}
                          </span>
                        ) : null}
                        {note._count.attachments > 0 ? (
                          <p className="small" style={{ margin: "4px 0 0 0" }}>
                            {attachmentsCount(words, note._count.attachments)}
                          </p>
                        ) : null}
                      </td>
                      <td className="small">
                        <span
                          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <Icon name={KIND_ICONS[note.kind] ?? "note"} size={16} />
                          {kindName(words, note.kind)}
                        </span>
                      </td>
                      <td className="small">
                        <FolderMoveForm
                          noteId={note.id}
                          folderId={note.folderId}
                          folders={folderChoices}
                          action={moveNoteToFolder}
                        />
                      </td>
                      <td className="small">{humanSize(note.sizeBytes)}</td>
                      <td className="small">
                        {note.updatedAt.toLocaleString(words.locale)}
                      </td>
                      <td className="cell-actions">
                        <div className="row-actions">
                          <Link
                            className="button compact icon-only"
                            href={`/note/${note.id}`}
                            title={words.openNote}
                            aria-label={words.openNote}
                          >
                            <Icon name="edit" />
                          </Link>
                          <ActionForm
                            action={toggleFavoriteFromLibrary}
                            label={note.favorite ? words.unstarIt : words.starIt}
                            icon="star"
                            iconOnly
                            on={note.favorite}
                            compact
                            quiet
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
                            label={words.moveToTrash}
                            icon="delete"
                            iconOnly
                            compact
                            danger
                            quiet
                            confirmation={words.confirmTrash}
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

          {pages > 1 ? (
            <nav className="pager" aria-label={words.pagerLabel}>
              {page > 1 ? (
                <Link className="button compact" href={pageLink(page - 1)}>
                  <Icon name="chevron_left" size={18} />
                  {words.earlier}
                </Link>
              ) : (
                <span />
              )}
              <span className="small">
                {words.pageWord} {Math.min(page, pages)} {words.ofWord} {pages}
              </span>
              {page < pages ? (
                <Link className="button compact" href={pageLink(page + 1)}>
                  {words.next}
                  <Icon name="chevron_right" size={18} />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </div>
      </div>
    </main>
  );
}
