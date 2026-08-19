import Link from "next/link";
import { Icon } from "@/components/Icon";
import { KajetMark } from "@/components/KajetMark";
import { currentWords } from "@/lib/language";

/*
  Notatka spod adresu /note/<id> nie istnieje, jest cudza albo została skasowana
  na stałe. Wcześniej wychodziła stąd angielska kartka Next.js - teraz mówimy
  po polsku i wprost, co się mogło stać, bo „Nie ma takiej notatki." samo w sobie
  brzmi jak oskarżenie.
*/

export async function generateMetadata() {
  return { title: (await currentWords()).metaNoteNotFound };
}

export default async function NoteNotFound() {
  const words = await currentWords();

  return (
    <main className="page" style={{ maxWidth: 620 }}>
      <KajetMark home="/library" />

      <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
        <p className="eyebrow">{words.error404}</p>
        <h1 style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="search_off" size={30} />
          {words.noteNotFoundHeading}
        </h1>
        <p className="lead">
          {words.noteNotFoundAbout}
        </p>

        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          <Link className="button primary" href="/library">
            <Icon name="menu_book" size={18} />
            {words.myNotes}
          </Link>
          <Link className="button" href="/library/trash">
            <Icon name="restore_from_trash" size={18} />
            {words.lookInTrash}
          </Link>
          <Link className="button" href="/note/new">
            <Icon name="note_add" size={18} />
            {words.newNoteEyebrow}
          </Link>
        </div>
      </div>
    </main>
  );
}
