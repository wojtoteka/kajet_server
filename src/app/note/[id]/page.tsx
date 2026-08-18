import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { humanSize } from "@/lib/quota";
import { settings, mailWorks } from "@/lib/settings";
import { shareUrl, ownerAccess } from "@/lib/sharing";
import { textAppearanceFromContent, textMarkdownFromContent } from "@/lib/text-note";
import { WRITING_COLUMNS, readWritingSettings } from "@/lib/writing-settings";
import { parseMindMapNote, defaultMindMapSeed } from "@/lib/mindmap-note";
import { parseHandwritingNote } from "@/lib/handwriting-note";
import { parseCodeNote, languageOptions } from "@/lib/code-note";
import { runnerState } from "@/lib/code-runner";
import { KajetMark } from "@/components/KajetMark";
import { NotePreview } from "@/components/NotePreview";
import { TextNoteEditor } from "@/components/TextNoteEditor";
import { MindMapEditor } from "@/components/MindMapEditor";
import { HandwritingEditor } from "@/components/HandwritingEditor";
import { CodeNotePanel } from "@/components/CodeNotePanel";
import { NoteLive } from "@/components/NoteLive";
import { aiVisibleFor } from "@/lib/ai/access";
import { aiHandles } from "@/lib/ai/tools";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { NoteActionsBar } from "@/components/NoteActionsBar";
import { ActionForm } from "@/components/ActionForm";
import { CopyableLink } from "@/components/CopyableLink";
import {
  revokeShare,
  share,
  saveTextNote,
  saveMindMapNote,
  saveHandwritingNote,
  saveCodeNote,
  runCodeAction,
  trashNote,
  restoreNote,
  purgeNote,
  toggleFavorite,
  uploadAttachment,
  removeAttachment,
  askAssistant,
  undoAssistant,
  readAiConversation,
  clearAiConversation,
} from "./actions";
import { currentWords } from "@/lib/language";
import type { Words } from "@/lib/i18n";

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

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const words = await currentWords();
  const access = await ownerAccess(id);

  // Soft-deleted notes are hidden from ownerAccess - look them up for trash view.
  if (!access.ok) {
    const sessionNote = await loadTrashedOwnNote(id);
    if (!sessionNote) notFound();
    return <TrashedNoteView note={sessionNote} words={words} />;
  }

  const note = access.access.note;
  const [shares, attachments, runState] = await Promise.all([
    prisma.share.findMany({
      where: { noteId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.attachment.findMany({
      where: { noteId: id },
      orderBy: { createdAt: "asc" },
      select: { name: true, mime: true, sizeBytes: true },
    }),
    runnerState(),
  ]);

  const userCanRun =
    settings.code.enabled && runState.works && Boolean(access.access.userId);
  // Re-check canRunCode from DB via owner session user id. Przy okazji bierzemy
  // ustawienia pisania z „Moje konto" - autozapis i grube pismo w edytorze.
  const owner = access.access.userId
    ? await prisma.user.findUnique({
        where: { id: access.access.userId },
        select: { canRunCode: true, canUseAi: true, aiConsentAt: true, ...WRITING_COLUMNS },
      })
    : null;
  const writing = readWritingSettings(owner);
  const canRun = Boolean(userCanRun && owner?.canRunCode);
  // Asystent pokazuje się właścicielowi z uprawnieniem, i tylko przy rodzajach
  // notatek, przy których w ogóle działa. Przy odręcznej nie ma czego czytać.
  const assistantHere = Boolean(owner && aiVisibleFor(owner) && aiHandles(note.kind));
  const runnerHint = !settings.code.enabled
    ? words.codeDisabledHere
    : !owner?.canRunCode
      ? words.codeDisabledForAccount
      : runState.description;

  const codeBody = note.kind === "CODE" ? parseCodeNote(note.content) : null;
  const mindMapBody =
    note.kind === "MINDMAP"
      ? (parseMindMapNote(note.content) ?? { ...defaultMindMapSeed(), viewX: 0, viewY: 0, zoom: 1 })
      : null;
  const handwritingBody =
    note.kind === "HANDWRITTEN" ? parseHandwritingNote(note.content) : null;

  return (
    <main className="page wide">
      <KajetMark />

      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">{kindName(words, note.kind)}</p>
          <h1 style={{ marginBottom: 4 }}>{note.title || words.untitled}</h1>
          <p className="small" style={{ margin: 0 }}>
            {words.changedWord} {note.updatedAt.toLocaleString(words.locale)} ·{" "}
            {humanSize(note.sizeBytes)}
            {note.favorite ? ` · ${words.favoriteWord}` : ""}
          </p>
        </div>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
          <NoteActionsBar
            noteId={note.id}
            favorite={note.favorite}
            trashAction={trashNote}
            restoreAction={restoreNote}
            purgeAction={purgeNote}
            favoriteAction={toggleFavorite}
          />
          <Link className="button compact" href="/library">
            {words.backToList}
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 24 }}>
        {/*
          Asystent stoi POD edytorem, zwinięty, wspólny dla trzech rodzajów
          notatki. Przy odręcznej nie ma go wcale - nie ma tam czego czytać.

          NoteLive owija sam edytor, nie całą stronę: to on przerysowuje pole do
          pisania, kiedy asystent zmieni treść. Poza opakowaniem zostają pliki
          przy notatce i udostępnianie - one dostają świeże dane bez niczyjej
          pomocy, bo są serwerowe i bezstanowe.
        */}
        <NoteLive
          version={note.version}
          ai={
            assistantHere
              ? {
                  noteId: note.id,
                  version: note.version,
                  consented: owner?.aiConsentAt != null,
                  askAction: askAssistant,
                  undoAction: undoAssistant,
                  historyAction: readAiConversation,
                  clearAction: clearAiConversation,
                }
              : null
          }
        >
          {note.kind === "TEXT" ? (
            <section>
              <p className="eyebrow" style={{ marginBottom: 10 }}>
                {words.editing}
              </p>
              <TextNoteEditor
                action={saveTextNote}
                uploadAction={uploadAttachment}
                noteId={note.id}
                version={note.version}
                title={note.title}
                markdown={textMarkdownFromContent(note.content)}
                appearance={textAppearanceFromContent(note.content)}
                autoSave={writing.autoSave}
                bold={writing.bold}
                submitLabel={words.save}
              />
            </section>
          ) : null}

          {note.kind === "MINDMAP" && mindMapBody ? (
            <section>
              <p className="eyebrow" style={{ marginBottom: 10 }}>
                {words.editingMindMap}
              </p>
              <MindMapEditor
                action={saveMindMapNote}
                noteId={note.id}
                version={note.version}
                title={note.title}
                initial={mindMapBody}
                autoSave={writing.autoSave}
                submitLabel={words.save}
              />
            </section>
          ) : null}

          {note.kind === "HANDWRITTEN" ? (
            handwritingBody ? (
              <section>
                <p className="eyebrow" style={{ marginBottom: 10 }}>
                  {words.editingHandwriting}
                </p>
                <HandwritingEditor
                  action={saveHandwritingNote}
                  uploadAction={uploadAttachment}
                  noteId={note.id}
                  version={note.version}
                  title={note.title}
                  initial={handwritingBody}
                  autoSave={writing.autoSave}
                  submitLabel={words.save}
                  attachments={attachments}
                />
              </section>
            ) : (
              <section>
                <p className="error">
                  {words.handwritingUnreadable}
                </p>
              </section>
            )
          ) : null}

          {note.kind === "CODE" ? (
            <section>
              <CodeNotePanel
                saveAction={saveCodeNote}
                runAction={runCodeAction}
                noteId={note.id}
                version={note.version}
                title={note.title}
                language={codeBody?.language ?? "python"}
                source={codeBody?.source ?? ""}
                languages={languageOptions()}
                canRun={canRun}
                runnerHint={runnerHint}
                autoSave={writing.autoSave}
                submitLabel={words.save}
              />
              {!codeBody ? (
                <p className="error" style={{ marginTop: 12 }}>
                  {words.codeUnreadable}
                </p>
              ) : null}
            </section>
          ) : null}

          {note.kind !== "TEXT" &&
          note.kind !== "CODE" &&
          note.kind !== "HANDWRITTEN" &&
          note.kind !== "MINDMAP" ? (
            <section>
              <NotePreview content={note.content} noteId={note.id} />
            </section>
          ) : null}
        </NoteLive>

        <AttachmentsPanel
          noteId={note.id}
          attachments={attachments}
          uploadAction={uploadAttachment}
          removeAction={removeAttachment}
        />

        <section className="sheet-ruled" style={{ paddingBlock: 24, paddingInlineEnd: 26 }}>
          <p className="eyebrow">{words.sharingEyebrow}</p>
          <h2 style={{ marginBottom: 8 }}>{words.shareThisNote}</h2>
          <p className="lead">{words.shareAbout}</p>

          <ActionForm action={share} label={words.shareButton} busyLabel={words.sharePreparing} primary>
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
                <label htmlFor="permission">{words.whatTheyMayDo}</label>
                <select id="permission" name="permission" defaultValue="READ">
                  <option value="READ">{words.readOnly}</option>
                  <option value="EDIT">{words.readAndEdit}</option>
                </select>
              </div>

              <div>
                <label htmlFor="email">{words.emailOptional}</label>
                <input id="email" name="email" type="email" placeholder={words.orJustTheLink} />
                {!mailWorks() ? (
                  <p className="small" style={{ marginTop: 4 }}>
                    {words.mailNotSet}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="validDays">{words.validForDays}</label>
                <input id="validDays" name="validDays" type="number" min={0} defaultValue={0} />
                <p className="small" style={{ marginTop: 4 }}>
                  {words.zeroMeansForever}
                </p>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <input
                type="checkbox"
                name="anonymousAllowed"
                defaultChecked
                style={{ width: "auto" }}
              />
              <span>{words.allowWithoutAccount}</span>
            </label>
          </ActionForm>

          {shares.length > 0 ? (
            <>
              <hr className="divider" />
              <p className="eyebrow">{words.alreadyShared}</p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{words.columnWho}</th>
                      <th style={{ width: 120 }}>{words.columnRights}</th>
                      <th style={{ width: 140 }}>{words.columnValidUntil}</th>
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
                                  {words.byNameNeedsSignIn}
                                </p>
                              </>
                            ) : (
                              <>
                                <span className="tag">{words.linkWord}</span>
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
                              {entry.permission === "EDIT" ? words.rightEdit : words.rightRead}
                            </span>
                          </td>
                          <td className="small">
                            {entry.expiresAt
                              ? `${entry.expiresAt.toLocaleDateString(words.locale)}${expired ? words.expiredMark : ""}`
                              : words.noDeadline}
                            {entry.lastUsedAt ? (
                              <p style={{ margin: "2px 0 0 0" }}>
                                {words.openedWord} {entry.lastUsedAt.toLocaleDateString(words.locale)}
                              </p>
                            ) : null}
                          </td>
                          <td>
                            <ActionForm
                              action={revokeShare}
                              label={words.revoke}
                              compact
                              danger
                              confirmation={words.confirmRevoke}
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

async function loadTrashedOwnNote(id: string) {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.note.findFirst({
    where: { id, ownerId: session.user.id, deletedAt: { not: null } },
    select: {
      id: true,
      title: true,
      kind: true,
      favorite: true,
      sizeBytes: true,
      version: true,
      updatedAt: true,
      deletedAt: true,
    },
  });
}

function TrashedNoteView({
  note,
  words,
}: {
  note: {
    id: string;
    title: string;
    kind: string;
    favorite: boolean;
    sizeBytes: number;
    version: number;
    updatedAt: Date;
    deletedAt: Date | null;
  };
  words: Words;
}) {
  return (
    <main className="page wide">
      <KajetMark />
      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">
            {words.inTrashWord} · {kindName(words, note.kind)}
          </p>
          <h1 style={{ marginBottom: 4 }}>{note.title || words.untitled}</h1>
          <p className="small" style={{ margin: 0 }}>
            {words.trashedWord}{" "}
            {(note.deletedAt ?? note.updatedAt).toLocaleString(words.locale)} ·{" "}
            {humanSize(note.sizeBytes)}
          </p>
        </div>
        <div className="row">
          <NoteActionsBar
            noteId={note.id}
            favorite={note.favorite}
            trashed
            trashAction={trashNote}
            restoreAction={restoreNote}
            purgeAction={purgeNote}
            favoriteAction={toggleFavorite}
          />
          <Link className="button compact" href="/library/trash">
            {words.trash}
          </Link>
        </div>
      </div>
      <div className="sheet-ruled" style={{ paddingBlock: 24, paddingInlineEnd: 26 }}>
        <p className="lead" style={{ margin: 0 }}>
          {words.noteInTrashAbout}
        </p>
      </div>
    </main>
  );
}
