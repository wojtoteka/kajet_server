import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { KajetMark } from "@/components/KajetMark";
import { MindMapEditor } from "@/components/MindMapEditor";
import { defaultMindMapSeed } from "@/lib/mindmap-note";
import { readWritingSettings } from "@/lib/writing-settings";
import { saveMindMapNote } from "../../[id]/actions";
import { currentWords } from "@/lib/language";

export async function generateMetadata() {
  return { title: (await currentWords()).metaNewMindMap };
}

export default async function NewMindMapPage() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/note/new/mindmap");

  const words = await currentWords();
  const seed = defaultMindMapSeed();

  return (
    <main className="page wide">
      <KajetMark caption={user.login} />

      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">{words.newNoteEyebrow}</p>
          <h1 style={{ marginBottom: 4 }}>{words.newMindMapTitle}</h1>
          <p className="small" style={{ margin: 0 }}>
            {words.newMindMapAbout}
          </p>
        </div>
        <Link className="button compact" href="/library">
          {words.cancel}
        </Link>
      </div>

      <MindMapEditor
        action={saveMindMapNote}
        title=""
        initial={{ ...seed, viewX: 0, viewY: 0, zoom: 1 }}
        autoSave={readWritingSettings(user).autoSave}
        submitLabel={words.createMapButton}
      />
    </main>
  );
}
