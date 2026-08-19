import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { KajetMark } from "@/components/KajetMark";
import { CodeNotePanel } from "@/components/CodeNotePanel";
import { NoteLive } from "@/components/NoteLive";
import { languageOptions } from "@/lib/code-note";
import { LANGUAGES, runnerState } from "@/lib/code-runner";
import { settings } from "@/lib/settings";
import { readWritingSettings } from "@/lib/writing-settings";
import {
  saveCodeNote,
  runCodeAction,
  askAssistant,
  undoAssistant,
  readAiConversation,
  clearAiConversation,
} from "@/app/note/[id]/actions";
import { aiVisibleFor } from "@/lib/ai/access";
import { currentWords } from "@/lib/language";

export async function generateMetadata() {
  return { title: (await currentWords()).metaNewCode };
}

export default async function NewCodeNotePage() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/note/new/code");

  const words = await currentWords();
  const state = await runnerState();
  const canRun = settings.code.enabled && state.works && user.canRunCode;
  const runnerHint = !settings.code.enabled
    ? words.codeDisabledHere
    : !user.canRunCode
      ? words.codeDisabledForAccount
      : state.description;

  const defaultLang = LANGUAGES[0]?.id ?? "python";

  return (
    <main className="page wide">
      <KajetMark home="/library" caption={user.login} />

      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">{words.newNoteEyebrow}</p>
          <h1 style={{ marginBottom: 4 }}>{words.newCodeNoteTitle}</h1>
          <p className="small" style={{ margin: 0 }}>
            {words.newCodeNoteAbout}
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
        <CodeNotePanel
          saveAction={saveCodeNote}
          runAction={runCodeAction}
          title=""
          language={defaultLang}
          source=""
          languages={languageOptions()}
          canRun={canRun}
          runnerHint={runnerHint}
          autoSave={readWritingSettings(user).autoSave}
          submitLabel={words.createFileButton}
        />
      </NoteLive>
    </main>
  );
}
