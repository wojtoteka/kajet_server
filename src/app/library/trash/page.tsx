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
import { currentWords } from "@/lib/language";
import { disappearsIn, notesCount, trashKeptFor, type Words } from "@/lib/i18n";
import { settings } from "@/lib/settings";
import { trashDaysLeft } from "@/lib/trash";

export async function generateMetadata() {
  return { title: (await currentWords()).trashTitle };
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

/** Tyle wyrzuconych notatek na stronę - reszta czeka na kolejnej. */
const PAGE_SIZE = 100;

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/library/trash");

  const words = await currentWords();
  const page = Math.max(1, Math.floor(Number((await searchParams).page) || 1));
  const where = { ownerId: user.id, deletedAt: { not: null } } as const;

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        title: true,
        kind: true,
        sizeBytes: true,
        deletedAt: true,
        updatedAt: true,
      },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.note.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLink = (target: number) =>
    target > 1 ? `/library/trash?page=${target}` : "/library/trash";

  return (
    <main className="page wide">
      <KajetMark home="/library" caption={user.login} />

      <div className="row-spread" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{words.trash}</h1>
          <p className="small" style={{ margin: 0 }}>
            {words.trashAbout}
            {settings.trash.days > 0 ? ` ${trashKeptFor(words, settings.trash.days)}` : ""}
          </p>
          {total > 0 ? (
            <p className="small" style={{ margin: "4px 0 0 0" }}>
              {total} {words.inTrash}
              {pages > 1
                ? ` · ${words.pageWord.toLowerCase()} ${Math.min(page, pages)} ${words.ofWord} ${pages}`
                : ""}
            </p>
          ) : null}
        </div>
        <div className="row">
          <Link className="button compact" href="/library">
            {words.backToList}
          </Link>
          {notes.length > 0 ? (
            <ActionForm
              action={emptyTrash}
              label={words.emptyTrashButton}
              compact
              danger
              confirmation={words.confirmEmptyTrash}
            />
          ) : null}
        </div>
      </div>

      {notes.length === 0 && total > 0 ? (
        <div className="sheet-ruled" style={{ paddingBlock: 28, paddingInlineEnd: 26 }}>
          <p className="eyebrow">{words.emptyPageTitle}</p>
          <h2 style={{ marginBottom: 8 }}>{words.emptyPageHeading}</h2>
          <p className="lead" style={{ margin: "0 0 16px 0" }}>
            {notesCount(words, total)} · {words.pageWord} {page} {words.ofWord} {pages}.
          </p>
          <Link className="button primary" href={pageLink(1)}>
            {words.backToStart}
          </Link>
        </div>
      ) : notes.length === 0 ? (
        <div className="sheet-ruled" style={{ paddingBlock: 28, paddingInlineEnd: 26 }}>
          <p className="eyebrow">{words.emptyEyebrow}</p>
          <h2 style={{ marginBottom: 8 }}>{words.trashEmptyHeading}</h2>
          <p className="lead" style={{ margin: 0 }}>
            {words.trashEmptyAbout}
          </p>
        </div>
      ) : (
        <div className="sheet table-scroll">
          {/* trash-table: na telefonie wiersze układają się w karty (globals.css).
              Bez tej klasy tabela łapała samą dolną granicę 640 px i tytuł
              notatki ściskał się do jednego słowa w linii. */}
          <table className="trash-table">
            <thead>
              <tr>
                <th>{words.columnNote}</th>
                <th style={{ width: 120 }}>{words.columnKind}</th>
                <th style={{ width: 100 }}>{words.columnSize}</th>
                <th style={{ width: 180 }}>{words.columnTrashed}</th>
                <th style={{ width: 200 }} />
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => {
                // Odliczanie do samoczynnego opróżnienia — jak w aplikacji.
                // Ostatnie dni na czerwono: wtedy warto się pospieszyć.
                const daysLeft =
                  settings.trash.days > 0 && note.deletedAt
                    ? trashDaysLeft(note.deletedAt)
                    : null;
                return (
                <tr key={note.id}>
                  <td>
                    <strong>{note.title || words.untitled}</strong>
                  </td>
                  <td className="small">{kindName(words, note.kind)}</td>
                  <td className="small">{humanSize(note.sizeBytes)}</td>
                  <td className="small">
                    {(note.deletedAt ?? note.updatedAt).toLocaleString(words.locale)}
                    {daysLeft !== null ? (
                      <div style={daysLeft <= 3 ? { color: "var(--warning)" } : undefined}>
                        {disappearsIn(words, daysLeft)}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                      <ActionForm action={restoreNoteFromTrash} label={words.restore} compact primary>
                        <input type="hidden" name="noteId" value={note.id} />
                      </ActionForm>
                      <ActionForm
                        action={purgeNoteFromTrash}
                        label={words.forGood}
                        compact
                        danger
                        confirmation={words.confirmPurge}
                      >
                        <input type="hidden" name="noteId" value={note.id} />
                      </ActionForm>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav className="pager" aria-label={words.trashPagerLabel}>
          {page > 1 ? (
            <Link className="button compact" href={pageLink(page - 1)}>
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
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
