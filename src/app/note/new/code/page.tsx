import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { KajetMark } from "@/components/KajetMark";
import { CodeNotePanel } from "@/components/CodeNotePanel";
import { languageOptions } from "@/lib/code-note";
import { LANGUAGES, runnerState } from "@/lib/code-runner";
import { settings } from "@/lib/settings";
import { saveCodeNote, runCodeAction } from "@/app/note/[id]/actions";

export const metadata = { title: "Nowy plik z kodem — Kajet" };

export default async function NewCodeNotePage() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/note/new/code");

  const state = await runnerState();
  const canRun = settings.code.enabled && state.works && user.canRunCode;
  const runnerHint = !settings.code.enabled
    ? "Uruchamianie kodu jest wyłączone na tym serwerze (CODE_ENABLED)."
    : !user.canRunCode
      ? "Administrator wyłączył uruchamianie kodu na Twoim koncie."
      : state.description;

  const defaultLang = LANGUAGES[0]?.id ?? "python";

  return (
    <main className="page wide">
      <KajetMark caption={user.login} />

      <div className="row-spread" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">Nowa notatka</p>
          <h1 style={{ marginBottom: 4 }}>Plik z kodem</h1>
          <p className="small" style={{ margin: 0 }}>
            Notatki z kodem żyją na serwerze i w panelu WWW. Aplikacja mobilna uruchamia kod
            przez to samo API.
          </p>
        </div>
        <Link className="button compact" href="/library">
          Anuluj
        </Link>
      </div>

      <CodeNotePanel
        saveAction={saveCodeNote}
        runAction={runCodeAction}
        title=""
        language={defaultLang}
        source=""
        languages={languageOptions()}
        canRun={canRun}
        runnerHint={runnerHint}
        submitLabel="Utwórz plik"
      />
    </main>
  );
}
