import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { KajetMark } from "@/components/KajetMark";
import { MindMapEditor } from "@/components/MindMapEditor";
import { defaultMindMapSeed } from "@/lib/mindmap-note";
import { saveMindMapNote } from "../../[id]/actions";

export const metadata = { title: "Nowa mapa myśli — Kajet" };

export default async function NewMindMapPage() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/note/new/mindmap");

  const seed = defaultMindMapSeed();

  return (
    <main className="page wide">
      <KajetMark caption={user.login} />

      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">Nowa notatka</p>
          <h1 style={{ marginBottom: 4 }}>Mapa myśli</h1>
          <p className="small" style={{ margin: 0 }}>
            Węzły i połączenia zapisują się w tym samym formacie co w aplikacji — po synchronizacji
            otworzysz je na tablecie.
          </p>
        </div>
        <Link className="button compact" href="/library">
          Anuluj
        </Link>
      </div>

      <MindMapEditor
        action={saveMindMapNote}
        title=""
        initial={{ ...seed, viewX: 0, viewY: 0, zoom: 1 }}
        submitLabel="Utwórz mapę"
      />
    </main>
  );
}
