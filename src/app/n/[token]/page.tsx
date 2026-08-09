import Link from "next/link";
import { tokenAccess } from "@/lib/sharing";
import { KajetMark } from "@/components/KajetMark";
import { NotePreview } from "@/components/NotePreview";
import { currentWords } from "@/lib/language";
import type { Words } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await currentWords()).metaSharedNote };
}

function kindName(words: Words, kind: string): string {
  switch (kind) {
    case "HANDWRITTEN":
      return words.noteHandwritten;
    case "TEXT":
      return words.noteTextKind;
    case "MINDMAP":
      return words.mindMap;
    case "CODE":
      return words.noteCodeKind;
    default:
      return kind;
  }
}

export default async function SharedNotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const words = await currentWords();
  const result = await tokenAccess(token);

  if (!result.ok) {
    return (
      <main className="page" style={{ maxWidth: 520 }}>
        <KajetMark />
        <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
          <p className="eyebrow">{words.linkEyebrow}</p>
          <h1 style={{ marginBottom: 10 }}>{words.cannotShowNote}</h1>
          <p className="lead">{result.reason}</p>
          <Link className="button" href="/signin">
            {words.signIn}
          </Link>
        </div>
      </main>
    );
  }

  const { note, canEdit, isOwner } = result.access;

  return (
    <main className="page wide">
      <KajetMark caption={words.sharedNoteCaption} />

      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">{kindName(words, note.kind)}</p>
          <h1 style={{ marginBottom: 4 }}>{note.title || words.untitled}</h1>
          <p className="small" style={{ margin: 0 }}>
            {words.changedWord} {note.updatedAt.toLocaleString(words.locale)}
            {canEdit ? ` · ${words.mayChangeIt}` : ` · ${words.readOnlyMark}`}
          </p>
        </div>
        {isOwner ? (
          <Link className="button compact" href={`/note/${note.id}`}>
            {words.openAsOwner}
          </Link>
        ) : null}
      </div>

      {canEdit ? (
        <p className="success">
          {words.canEditButNoEditor}
        </p>
      ) : null}

      <NotePreview content={note.content} noteId={note.id} token={token} />

      <hr className="divider" />
      <p className="small">
        {words.thisIsAKajetNote}{" "}
        <Link href="/">{words.seeWhatItIs}</Link>
      </p>
    </main>
  );
}
