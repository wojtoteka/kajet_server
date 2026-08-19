import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { KajetMark } from "@/components/KajetMark";
import { TextNoteEditor } from "@/components/TextNoteEditor";
import { NoteLive } from "@/components/NoteLive";
import { readWritingSettings } from "@/lib/writing-settings";
import {
  saveTextNote,
  uploadAttachment,
  askAssistant,
  undoAssistant,
  readAiConversation,
  clearAiConversation,
} from "../[id]/actions";
import { aiVisibleFor } from "@/lib/ai/access";
import { currentWords } from "@/lib/language";

export async function generateMetadata() {
  return { title: (await currentWords()).metaNewText };
}

export default async function NewTextNotePage() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/note/new");

  // Nowa notatka startuje z wyglądem wybranym w „Moje konto".
  const words = await currentWords();
  const writing = readWritingSettings(user);

  return (
    <main className="page wide">
      <KajetMark home="/library" caption={user.login} />

      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">{words.newNoteEyebrow}</p>
          <h1 style={{ marginBottom: 4 }}>{words.newTextNoteTitle}</h1>
          <p className="small" style={{ margin: 0 }}>
            {words.newTextNoteAbout}
          </p>
        </div>
        <Link className="button compact" href="/library">
          {words.cancel}
        </Link>
      </div>

      {/*
        Asystent stoi tu tak samo jak przy notatce już zapisanej. Notatka
        powstaje w chwili, gdy KajetAI dostaje pierwsze polecenie: panel
        wymusza zapis, ZANIM cokolwiek pojedzie do modelu, bo model czyta
        notatkę z bazy, a nie z ekranu. Dzięki temu można kliknąć „nowa
        notatka" i od razu poprosić o pomoc, nie nazywając jej wcześniej.
      */}
      <NoteLive
        version={0}
        ai={
          aiVisibleFor(user)
            ? {
                version: 0,
                consented: user.aiConsentAt != null,
                askAction: askAssistant,
                undoAction: undoAssistant,
                historyAction: readAiConversation,
                clearAction: clearAiConversation,
              }
            : null
        }
      >
        <TextNoteEditor
          action={saveTextNote}
          uploadAction={uploadAttachment}
          title=""
          markdown=""
          appearance={{
            font: writing.font,
            fontSize: writing.fontSize,
            textColor: 0,
            align: writing.align,
          }}
          autoSave={writing.autoSave}
          bold={writing.bold}
          submitLabel={words.createNoteButton}
        />
      </NoteLive>
    </main>
  );
}
