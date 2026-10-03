import { NotePreview } from "@/components/NotePreview";
import { AutoPrint } from "@/components/AutoPrint";
import { currentWords } from "@/lib/language";
import { noteDisplayDecision, type NoteForDisplay } from "@/lib/note-display";

/*
  Notatka na papier: tytuł, data i treść narysowana tym samym podglądem, co
  strona z odnośnikiem tylko do odczytu. Ten sam widok dostaje właściciel
  (/note/…/print) i odbiorca odnośnika (/n/…/print) - różni się tylko adres
  zdjęć, o który dba token.
*/
export async function PrintableNote({
  note,
  token,
}: {
  note: NoteForDisplay & { id: string; title: string; updatedAt: Date };
  token?: string;
}) {
  const words = await currentWords();
  const display = noteDisplayDecision(note);

  return (
    <main className="page print-page">
      <AutoPrint />
      <h1 style={{ marginBottom: 4 }}>{note.title || words.untitled}</h1>
      <p className="small" style={{ marginTop: 0, marginBottom: 20 }}>
        {note.updatedAt.toLocaleString(words.locale)}
      </p>
      {display.tooLarge ? (
        <p className="lead">{words.printTooLarge}</p>
      ) : (
        <NotePreview content={note.content} noteId={note.id} token={token} />
      )}
    </main>
  );
}
