import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tokenAccess } from "@/lib/sharing";
import { writingSettingsFor } from "@/lib/writing-settings";
import { textAppearanceFromContent, textMarkdownFromContent } from "@/lib/text-note";
import { parseMindMapNote } from "@/lib/mindmap-note";
import { parseHandwritingNote } from "@/lib/handwriting-note";
import { parseCodeNote, languageOptions } from "@/lib/code-note";
import { KajetMark } from "@/components/KajetMark";
import { NotePreview } from "@/components/NotePreview";
import { TextNoteEditor } from "@/components/TextNoteEditor";
import { MindMapEditor } from "@/components/MindMapEditor";
import { HandwritingEditor } from "@/components/HandwritingEditor";
import { CodeNotePanel } from "@/components/CodeNotePanel";
import { runCodeAction } from "@/app/note/[id]/actions";
import {
  saveSharedTextNote,
  saveSharedMindMapNote,
  saveSharedHandwritingNote,
  saveSharedCodeNote,
} from "./actions";
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

  /*
    Edycja przez odnośnik używa tych samych edytorów co właściciel - różni się
    tylko akcja zapisu (sprawdza udostępnienie, nie własność; token wjeżdża
    przez .bind, żeby notatka zawsze wynikała z odnośnika). Ustawienia pisania
    (autozapis, grube pismo) są tego, kto pisze; bez konta - domyślne.
  */
  const writing = canEdit ? await writingSettingsFor(result.access.userId) : null;

  // Zdjęcia już wysłane do notatki - edytor odręczny umie je wstawiać, choć
  // wysyłanie nowych zostaje u właściciela.
  const attachments =
    canEdit && note.kind === "HANDWRITTEN"
      ? await prisma.attachment.findMany({
          where: { noteId: note.id },
          orderBy: { createdAt: "asc" },
          select: { name: true, mime: true, sizeBytes: true },
        })
      : [];

  const codeBody = canEdit && note.kind === "CODE" ? parseCodeNote(note.content) : null;
  const mindMapBody =
    canEdit && note.kind === "MINDMAP" ? parseMindMapNote(note.content) : null;
  const handwritingBody =
    canEdit && note.kind === "HANDWRITTEN" ? parseHandwritingNote(note.content) : null;

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

      {canEdit && note.kind === "TEXT" ? (
        <section>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            {words.editing}
          </p>
          <TextNoteEditor
            action={saveSharedTextNote.bind(null, token)}
            noteId={note.id}
            version={note.version}
            title={note.title}
            markdown={textMarkdownFromContent(note.content)}
            appearance={textAppearanceFromContent(note.content)}
            autoSave={writing?.autoSave}
            bold={writing?.bold}
            submitLabel={words.save}
            token={token}
          />
        </section>
      ) : null}

      {canEdit && note.kind === "MINDMAP" ? (
        mindMapBody ? (
          <section>
            <p className="eyebrow" style={{ marginBottom: 10 }}>
              {words.editingMindMap}
            </p>
            <MindMapEditor
              action={saveSharedMindMapNote.bind(null, token)}
              noteId={note.id}
              version={note.version}
              title={note.title}
              initial={mindMapBody}
              autoSave={writing?.autoSave}
              submitLabel={words.save}
            />
          </section>
        ) : (
          // Nieczytelnej mapy nie podmieniamy pustą - u siebie właściciel może
          // zaczynać od zera, ale odbiorca zobaczy chociaż podgląd.
          <section>
            <p className="error">{words.actMindMapUnreadable}</p>
            <NotePreview content={note.content} noteId={note.id} token={token} />
          </section>
        )
      ) : null}

      {canEdit && note.kind === "HANDWRITTEN" ? (
        handwritingBody ? (
          <section>
            <p className="eyebrow" style={{ marginBottom: 10 }}>
              {words.editingHandwriting}
            </p>
            <HandwritingEditor
              action={saveSharedHandwritingNote.bind(null, token)}
              noteId={note.id}
              version={note.version}
              title={note.title}
              initial={handwritingBody}
              autoSave={writing?.autoSave}
              submitLabel={words.save}
              attachments={attachments}
              token={token}
            />
          </section>
        ) : (
          <section>
            <p className="error">{words.handwritingUnreadable}</p>
            <NotePreview content={note.content} noteId={note.id} token={token} />
          </section>
        )
      ) : null}

      {canEdit && note.kind === "CODE" ? (
        <section>
          <CodeNotePanel
            saveAction={saveSharedCodeNote.bind(null, token)}
            runAction={runCodeAction}
            noteId={note.id}
            version={note.version}
            title={note.title}
            language={codeBody?.language ?? "python"}
            source={codeBody?.source ?? ""}
            languages={languageOptions()}
            canRun={false}
            runnerHint={words.codeRunOwnerOnly}
            autoSave={writing?.autoSave}
            submitLabel={words.save}
          />
          {!codeBody ? (
            <p className="error" style={{ marginTop: 12 }}>
              {words.codeUnreadable}
            </p>
          ) : null}
        </section>
      ) : null}

      {!canEdit ? <NotePreview content={note.content} noteId={note.id} token={token} /> : null}

      <hr className="divider" />
      <p className="small">
        {words.thisIsAKajetNote} <Link href="/">{words.seeWhatItIs}</Link>
      </p>
    </main>
  );
}
