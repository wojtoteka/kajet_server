import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { KajetMark } from "@/components/KajetMark";
import { TextNoteEditor } from "@/components/TextNoteEditor";
import { saveTextNote } from "../[id]/actions";

export const metadata = { title: "Nowa notatka tekstowa — Kajet" };

export default async function NewTextNotePage() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/note/new");

  return (
    <main className="page wide">
      <KajetMark caption={user.login} />

      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">Nowa notatka</p>
          <h1 style={{ marginBottom: 4 }}>Notatka tekstowa</h1>
          <p className="small" style={{ margin: 0 }}>
            Po zapisaniu pojawi się też na tablecie przy następnej synchronizacji.
          </p>
        </div>
        <Link className="button compact" href="/library">
          Anuluj
        </Link>
      </div>

      <TextNoteEditor
        action={saveTextNote}
        title=""
        markdown=""
        submitLabel="Utwórz notatkę"
      />
    </main>
  );
}
