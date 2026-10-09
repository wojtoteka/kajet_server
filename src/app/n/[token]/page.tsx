import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { folderTokenAccess, tokenAccess } from "@/lib/sharing";
import { listSharedFolder } from "@/lib/shared-library";
import { folderIcon, folderTint } from "@/lib/folder-look";
import { Icon, type IconName } from "@/components/Icon";
import { ActionForm } from "@/components/ActionForm";
import { AcceptShare } from "@/components/AcceptShare";
import { OpenInApp } from "@/components/OpenInApp";
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
import { LargeNoteNotice } from "@/components/LargeNoteNotice";
import { PrintButton } from "@/components/PrintButton";
import { runCodeAction } from "@/app/note/[id]/actions";
import {
  acceptSharedLink,
  createSharedTextNote,
  saveSharedTextNote,
  saveSharedMindMapNote,
  saveSharedHandwritingNote,
  saveSharedCodeNote,
} from "./actions";
import { currentWords } from "@/lib/language";
import { noteDisplayDecision } from "@/lib/note-display";
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

function Refused({ words, reason }: { words: Words; reason: string }) {
  return (
    <main className="page" style={{ maxWidth: 520 }}>
      <KajetMark />
      <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
        <p className="eyebrow">{words.linkEyebrow}</p>
        <h1 style={{ marginBottom: 10 }}>{words.cannotShowNote}</h1>
        <p className="lead">{reason}</p>
        <Link className="button" href="/signin">
          {words.signIn}
        </Link>
      </div>
    </main>
  );
}

/*
  Odnośnik do notatki albo do folderu.

  Folder pokazuje swoją zawartość (`?folder=` - podfolder), a notatka
  z folderu otwiera się pod tym samym odnośnikiem z `?note=`. Notatka musi
  leżeć w udostępnionym folderze albo głębiej - pilnuje tego tokenAccess.

  Udostępnienie imienne przyjmuje się tutaj, w przeglądarce otwierającego
  (AcceptShare) - od tej chwili stoi ono w jego bibliotece.
*/
export default async function SharedNotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ note?: string; folder?: string }>;
}) {
  const { token } = await params;
  const { note: noteParam, folder: folderParam } = await searchParams;
  const words = await currentWords();

  const kind = await prisma.share.findUnique({
    where: { token },
    select: { folderId: true, email: true },
  });
  const personal = Boolean(kind?.email);

  if (kind?.folderId && !noteParam) {
    return (
      <SharedFolderView token={token} folderId={folderParam ?? null} personal={personal} />
    );
  }

  return (
    <SharedNoteView
      token={token}
      noteId={kind?.folderId ? (noteParam ?? null) : null}
      personal={personal}
    />
  );
}

async function SharedFolderView({
  token,
  folderId,
  personal,
}: {
  token: string;
  folderId: string | null;
  personal: boolean;
}) {
  const words = await currentWords();
  const access = await folderTokenAccess(token);
  if (!access.ok) return <Refused words={words} reason={access.reason} />;

  const listing = await listSharedFolder(
    {
      share: { ...access.share, sharedBy: await sharer(access.share.sharedById) },
      ownerId: access.share.folder.ownerId,
      canEdit: access.canEdit,
    },
    folderId,
  );
  if (!listing) return <Refused words={words} reason={words.apiLinkDead} />;
  const owner = await sharer(access.share.sharedById);
  const accept = acceptSharedLink.bind(null, token);
  const here = (id: string) => `/n/${token}?folder=${encodeURIComponent(id)}`;

  return (
    <main className="page wide">
      <KajetMark caption={words.sharedFolderCaption} />
      {personal ? <AcceptShare accept={accept} /> : null}

      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">
            {listing.path.map((step, index) => (
              <span key={step.id}>
                {index > 0 ? " / " : ""}
                {index < listing.path.length - 1 ? (
                  <Link href={here(step.id)}>{step.name}</Link>
                ) : (
                  step.name
                )}
              </span>
            ))}
          </p>
          <h1 style={{ marginBottom: 4 }}>{listing.folder.name}</h1>
          <p className="small" style={{ margin: 0 }}>
            {words.sharedByWord} {owner.name || owner.login} ·{" "}
            {access.canEdit ? words.mayChangeIt : words.readOnlyMark}
          </p>
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <OpenInApp path={`/n/${token}`} />
          {access.canEdit ? (
            <ActionForm
              action={createSharedTextNote.bind(null, token, listing.folder.id)}
              label={words.newTextNoteHere}
              icon="note_add"
              compact
            />
          ) : null}
        </div>
      </div>

      {listing.folders.length === 0 && listing.notes.length === 0 ? (
        <p className="lead">{words.sharedFolderEmpty}</p>
      ) : null}

      {listing.folders.length > 0 ? (
        <ul className="folder-list" style={{ marginBottom: 18 }}>
          {listing.folders.map((folder) => (
            <li key={folder.id}>
              <Link className="folder-row" href={here(folder.id)} style={folderTint(folder.colorId)}>
                <Icon name={folderIcon(folder.iconId)} className="folder-mark tinted" filled />
                <span className="folder-name">{folder.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {listing.notes.length > 0 ? (
        <ul className="folder-list">
          {listing.notes.map((note) => (
            <li key={note.id}>
              <Link className="folder-row" href={`/n/${token}?note=${encodeURIComponent(note.id)}`}>
                <Icon name={noteIcon(note.kind)} className="folder-mark" />
                <span className="folder-name">{note.title || words.untitled}</span>
                <span className="folder-count small">
                  {new Date(note.updatedAt).toLocaleDateString(words.locale)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <hr className="divider" />
      <p className="small">
        {words.thisIsAKajetNote} <Link href="/">{words.seeWhatItIs}</Link>
      </p>
    </main>
  );
}

function noteIcon(kind: string): IconName {
  switch (kind) {
    case "HANDWRITTEN":
      return "draw";
    case "MINDMAP":
      return "account_tree";
    case "CODE":
      return "code";
    default:
      return "article";
  }
}

async function sharer(userId: string): Promise<{ login: string; name: string | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { login: true, name: true },
  });
  return user ?? { login: "", name: null };
}

async function SharedNoteView({
  token,
  noteId,
  personal,
}: {
  token: string;
  noteId: string | null;
  personal: boolean;
}) {
  const words = await currentWords();
  const result = await tokenAccess(token, noteId);

  if (!result.ok) return <Refused words={words} reason={result.reason} />;
  const accept = acceptSharedLink.bind(null, token);
  const inFolder = Boolean(noteId);
  const session = await auth();
  const viewerName = session?.user?.login ?? session?.user?.name ?? words.guestWord;

  const { note, canEdit, isOwner } = result.access;
  // Także odnośnik tylko do odczytu omija ciężki NotePreview. Inaczej duży
  // plik blokowałby stronę udostępnienia mimo ochrony w widoku właściciela.
  const display = noteDisplayDecision(note);

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
    canEdit && !display.tooLarge && note.kind === "HANDWRITTEN"
      ? await prisma.attachment.findMany({
          where: { noteId: note.id },
          orderBy: { createdAt: "asc" },
          select: { name: true, mime: true, sizeBytes: true },
        })
      : [];

  const codeBody =
    canEdit && !display.tooLarge && note.kind === "CODE" ? parseCodeNote(note.content) : null;
  const mindMapBody =
    canEdit && !display.tooLarge && note.kind === "MINDMAP" ? parseMindMapNote(note.content) : null;
  const handwritingBody =
    canEdit && !display.tooLarge && note.kind === "HANDWRITTEN"
      ? parseHandwritingNote(note.content)
      : null;

  return (
    <main className="page wide">
      <KajetMark caption={words.sharedNoteCaption} />
      {personal ? <AcceptShare accept={accept} /> : null}

      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">{kindName(words, note.kind)}</p>
          <h1 style={{ marginBottom: 4 }}>{note.title || words.untitled}</h1>
          <p className="small" style={{ margin: 0 }}>
            {words.changedWord} {note.updatedAt.toLocaleString(words.locale)}
            {canEdit ? ` · ${words.mayChangeIt}` : ` · ${words.readOnlyMark}`}
          </p>
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          {inFolder ? (
            <Link className="button compact" href={`/n/${token}`}>
              {words.backToSharedFolder}
            </Link>
          ) : null}
          <OpenInApp path={`/n/${token}`} />
          <PrintButton href={`/n/${token}/print${inFolder ? `?note=${encodeURIComponent(note.id)}` : ""}`} />
          {isOwner ? (
            <Link className="button compact" href={`/note/${note.id}`}>
              {words.openAsOwner}
            </Link>
          ) : null}
        </div>
      </div>

      {display.tooLarge ? (
        <LargeNoteNotice
          words={words}
          sizeBytes={display.sizeBytes}
          limitBytes={display.limitBytes}
          downloadHref={`/n/${token}/download${inFolder ? `?note=${encodeURIComponent(note.id)}` : ""}`}
        />
      ) : (
        <>
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
              token={token}
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
        </>
      )}

      <hr className="divider" />
      <p className="small">
        {words.thisIsAKajetNote} <Link href="/">{words.seeWhatItIs}</Link>
      </p>
    </main>
  );
}
