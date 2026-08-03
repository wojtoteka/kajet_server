import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { KajetMark } from "@/components/KajetMark";
import { HandwritingEditor } from "@/components/HandwritingEditor";
import { defaultHandwritingSeed } from "@/lib/handwriting-note";
import { saveHandwritingNote } from "../../[id]/actions";

export const metadata = { title: "Nowa notatka odręczna — Kajet" };

export default async function NewHandwritingPage() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/note/new/handwriting");

  return (
    <main className="page wide">
      <KajetMark caption={user.login} />

      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">Nowa notatka</p>
          <h1 style={{ marginBottom: 4 }}>Notatka odręczna</h1>
          <p className="small" style={{ margin: 0 }}>
            Rysuj myszą lub rysikiem. Kreski zapisują się w formacie Kajetu (6 wartości na punkt),
            więc wrócą na tablet przy synchronizacji.
          </p>
        </div>
        <Link className="button compact" href="/library">
          Anuluj
        </Link>
      </div>

      <HandwritingEditor
        action={saveHandwritingNote}
        title=""
        initial={defaultHandwritingSeed()}
        submitLabel="Utwórz notatkę"
      />
    </main>
  );
}
