import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { KajetMark } from "@/components/KajetMark";
import { HandwritingEditor } from "@/components/HandwritingEditor";
import { defaultHandwritingSeed } from "@/lib/handwriting-note";
import { readWritingSettings } from "@/lib/writing-settings";
import { saveHandwritingNote, uploadAttachment } from "../../[id]/actions";
import { currentWords } from "@/lib/language";

export async function generateMetadata() {
  return { title: (await currentWords()).metaNewHandwriting };
}

export default async function NewHandwritingPage() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/note/new/handwriting");

  const words = await currentWords();

  return (
    <main className="page wide">
      <KajetMark caption={user.login} />

      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">{words.newNoteEyebrow}</p>
          <h1 style={{ marginBottom: 4 }}>{words.newHandwritingTitle}</h1>
          <p className="small" style={{ margin: 0 }}>
            {words.newHandwritingAbout}
          </p>
        </div>
        <Link className="button compact" href="/library">
          {words.cancel}
        </Link>
      </div>

      <HandwritingEditor
        action={saveHandwritingNote}
        uploadAction={uploadAttachment}
        title=""
        initial={defaultHandwritingSeed()}
        autoSave={readWritingSettings(user).autoSave}
        submitLabel={words.createNoteButton}
      />
    </main>
  );
}
