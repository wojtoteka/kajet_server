import Link from "next/link";
import { tokenAccess } from "@/lib/sharing";
import { KajetMark } from "@/components/KajetMark";
import { NotePreview } from "@/components/NotePreview";

export const metadata = { title: "Udostępniona notatka — Kajet" };

const KIND_NAMES: Record<string, string> = {
  HANDWRITTEN: "Notatka odręczna",
  TEXT: "Notatka tekstowa",
  MINDMAP: "Mapa myśli",
  CODE: "Plik z kodem",
};

export default async function SharedNotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await tokenAccess(token);

  if (!result.ok) {
    return (
      <main className="page" style={{ maxWidth: 520 }}>
        <KajetMark />
        <div className="sheet-ruled" style={{ paddingBlock: 32, paddingInlineEnd: 28 }}>
          <p className="eyebrow">Odnośnik</p>
          <h1 style={{ marginBottom: 10 }}>Nie możemy pokazać tej notatki</h1>
          <p className="lead">{result.reason}</p>
          <Link className="button" href="/signin">
            Zaloguj się
          </Link>
        </div>
      </main>
    );
  }

  const { note, canEdit, isOwner } = result.access;

  return (
    <main className="page wide">
      <KajetMark caption="udostępniona notatka" />

      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">{KIND_NAMES[note.kind] ?? note.kind}</p>
          <h1 style={{ marginBottom: 4 }}>{note.title || "Bez nazwy"}</h1>
          <p className="small" style={{ margin: 0 }}>
            Zmieniona {note.updatedAt.toLocaleString("pl-PL")}
            {canEdit ? " · masz prawo do zmian" : " · tylko do czytania"}
          </p>
        </div>
        {isOwner ? (
          <Link className="button compact" href={`/note/${note.id}`}>
            Otwórz jako właściciel
          </Link>
        ) : null}
      </div>

      {canEdit ? (
        <p className="success">
          Masz prawo poprawiać tę notatkę. Edytor w przeglądarce jest jeszcze w robocie, więc
          na razie możesz ją tylko przeczytać.
        </p>
      ) : null}

      <NotePreview content={note.content} noteId={note.id} token={token} />

      <hr className="divider" />
      <p className="small">
        To jest notatka z Kajetu, notatnika na tablet z rysikiem.{" "}
        <Link href="/">Zobacz, o co chodzi</Link>
      </p>
    </main>
  );
}
