"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useWords } from "@/components/LanguageProvider";
import { useNoteSync } from "@/components/NoteSync";
import type { AiAnswer, AiUndoAnswer } from "@/app/note/[id]/actions";

/*
  Panel asystenta w panelu WWW - ten sam, co w aplikacji, tylko w przeglądarce.

  Pokazuje się WYŁĄCZNIE przy koncie z uprawnieniem; rozstrzyga to strona
  notatki, zanim go w ogóle wyrenderuje. Tu nie ma zapasowej bramki, bo
  prawdziwa i tak stoi na serwerze - ukrycie pola nigdy nie było
  zabezpieczeniem.

  Panel stoi POD edytorem i jest domyślnie zwinięty. Wcześniej siedział nad
  notatką, zawsze otwarty, i zabierał dwieście pikseli, zanim widać było
  pierwszą literę.

  Dwie rzeczy dzieją się tu, zanim polecenie w ogóle pojedzie do modelu:

  1. NOTATKA IDZIE NA SERWER. Model czyta ją z bazy, nie z ekranu, więc bez
     tego pracowałby na treści sprzed ostatnich zdań - albo, przy notatce
     dopiero zakładanej, nie miałby czego czytać. Ten sam zapis zakłada
     notatkę, której jeszcze nie ma, więc o pomoc można poprosić od razu po
     kliknięciu „nowa notatka".

  2. WERSJA BIERZE SIĘ Z TEGO ZAPISU, a nie z propsa strony. Autozapis celowo
     nie odświeża strony notatki, więc numer wersji na niej starzeje się już
     po pierwszym dopisanym słowie - a wysłanie starego numeru kończyło się
     komunikatem „Ta notatka zmieniła się w innym miejscu", choć nikt jej
     nigdzie indziej nie tknął.

  Cofnięcie wraca do treści, którą serwer PRZYSŁAŁ jako sprzed zmiany. Props
  strony się do tego nie nadaje: po odświeżeniu niesie już treść po zmianie,
  a bez odświeżenia bywa starszy niż to, co widział model. Nie ma osobnej
  ścieżki „przywróć" na serwerze: stara treść wraca zwykłym zapisem, jako
  kolejna wersja notatki.
*/

type Turn = { request: string; reply: string };

export type AiPanelProps = {
  /**
   * Pusto przy notatce, której jeszcze nie ma. Prawdziwy identyfikator
   * przychodzi z zapisu wymuszonego przed pierwszym poleceniem.
   */
  noteId?: string;
  version: number;
  consented: boolean;
  askAction: (noteId: string, instruction: string, baseVersion: number) => Promise<AiAnswer>;
  undoAction: (noteId: string, content: string, baseVersion: number) => Promise<AiUndoAnswer>;
  historyAction: (noteId: string) => Promise<Turn[]>;
  clearAction: (noteId: string) => Promise<boolean>;
  /**
   * Melunek dla strony: asystent doprowadził notatkę do tej wersji. Strona
   * czeka, aż serwer poda jej tę wersję, i dopiero wtedy przerysowuje edytor -
   * bez tego pole do pisania pokazywałoby starą treść aż do odświeżenia.
   */
  onApplied?: (version: number) => void;
};

export function AiPanel({
  noteId,
  version,
  consented,
  askAction,
  undoAction,
  historyAction,
  clearAction,
  onApplied,
}: AiPanelProps) {
  const words = useWords();
  const router = useRouter();
  const sync = useNoteSync();
  /*
    Zwykły stan, a NIE useTransition.

    Panel każe edytorowi zapisać notatkę i czeka na odpowiedź serwera. Gdyby
    działo się to w środku przejścia Reacta, zapis edytora - też akcja -
    trafiłby w to samo przejście, które właśnie na niego czeka. Wychodzi z tego
    czekanie na samego siebie, do wyczerpania cierpliwości. Akcje serwerowe są
    zwykłymi funkcjami asynchronicznymi i nie potrzebują przejścia do niczego
    poza `isPending`, a to umiemy potrzymać sami.
  */
  const [busy, setBusy] = useState(false);

  const [instruction, setInstruction] = useState("");
  const [answer, setAnswer] = useState<AiAnswer | AiUndoAnswer | null>(null);
  const [undoneAt, setUndoneAt] = useState<number | null>(null);
  const [turns, setTurns] = useState<Turn[] | null>(null);

  /** Treść sprzed ostatniej zmiany asystenta. To do niej wraca „Cofnij". */
  const before = useRef<string | null>(null);
  /** Notatka, o której panel wie w tej chwili - po zapisie może być nowsza. */
  const live = useRef<{ noteId?: string; version: number }>({ noteId, version });
  /** Czy notatka istniała, gdy strona się otwierała. */
  const wasNew = useRef(!noteId);

  async function ask() {
    const asked = instruction.trim();
    if (!asked || busy) return;
    setBusy(true);
    try {
      // Najpierw zapis, potem pytanie - w tej kolejności i bez wyjątków.
      const fresh = (await sync?.settle()) ?? {};
      const id = fresh.noteId ?? live.current.noteId ?? noteId;
      const base = Math.max(fresh.version ?? 0, live.current.version, version);

      if (!id) {
        setAnswer({ status: "blad", message: words.aiNoteNotSavedYet });
        return;
      }

      const result = await askAction(id, asked, base);
      setAnswer(result);
      setUndoneAt(null);

      if (result.status === "zmieniono") {
        before.current = result.before;
        live.current = { noteId: result.noteId, version: result.version };
        setInstruction("");
        onApplied?.(result.version);
        // Notatka powstała dopiero teraz, a strona „nowa notatka" nie ma z
        // czego pokazać jej treści. Przechodzimy na stronę notatki - tam jest
        // i świeży tekst, i historia rozmowy.
        if (wasNew.current) router.replace(`/note/${result.noteId}`);
        else router.refresh();
      }
      if (turns !== null) setTurns(await historyAction(id));
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    const back = before.current;
    const id = live.current.noteId ?? noteId;
    if (back === null || !id || busy) return;

    setBusy(true);
    try {
      const fresh = (await sync?.settle()) ?? {};
      const base = Math.max(fresh.version ?? 0, live.current.version, version);
      const result = await undoAction(id, back, base);

      if (result.status === "zmieniono") {
        setAnswer(null);
        setUndoneAt(Date.now());
        before.current = null;
        live.current = { noteId: id, version: result.version };
        onApplied?.(result.version);
        router.refresh();
      } else {
        setAnswer(result);
      }
    } finally {
      setBusy(false);
    }
  }

  const changed = answer?.status === "zmieniono";

  return (
    <details className="sheet ai-fold">
      <summary>
        <span className="eyebrow">{words.aiTitle}</span>
      </summary>

      <div className="ai-body">
        {!consented ? (
          <>
            <p className="lead" style={{ margin: "0 0 12px 0" }}>{words.aiNeedsConsent}</p>
            <Link className="button compact" href="/account#asystent">
              {words.aiGoToAccount}
            </Link>
          </>
        ) : (
          <>
            <div className="field" style={{ marginBottom: 10 }}>
              <label htmlFor="ai-instruction">{words.aiHint}</label>
              <textarea
                id="ai-instruction"
                rows={2}
                value={instruction}
                disabled={busy}
                onChange={(event) => setInstruction(event.target.value)}
              />
            </div>

            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                className="compact primary"
                onClick={ask}
                disabled={busy || instruction.trim() === ""}
              >
                {busy ? words.aiWorking : words.aiAsk}
              </button>

              {changed && before.current !== null ? (
                <button type="button" className="compact" onClick={undo} disabled={busy}>
                  <Icon name="undo" size={18} />
                  {words.aiUndo}
                </button>
              ) : null}
            </div>

            {answer?.status === "zmieniono" ? (
              <p className="lead" style={{ margin: "12px 0 0 0" }}>{answer.opis}</p>
            ) : null}

            {answer?.status === "pytanie" ? (
              <div style={{ marginTop: 12 }}>
                <p className="eyebrow">{words.aiQuestionLabel}</p>
                <p className="lead" style={{ margin: "4px 0 0 0" }}>{answer.pytanie}</p>
              </div>
            ) : null}

            {answer?.status === "konflikt" ? (
              <p className="error" style={{ marginTop: 12 }}>{words.apiConflict}</p>
            ) : null}

            {answer?.status === "blad" ? (
              <p className="error" style={{ marginTop: 12 }}>{answer.message}</p>
            ) : null}

            {undoneAt !== null ? (
              <p className="lead" style={{ margin: "12px 0 0 0" }}>{words.aiUndone}</p>
            ) : null}

            <details
              style={{ marginTop: 14 }}
              onToggle={async (event) => {
                const id = live.current.noteId ?? noteId;
                if ((event.target as HTMLDetailsElement).open && turns === null) {
                  setTurns(id ? await historyAction(id) : []);
                }
              }}
            >
              <summary className="eyebrow" style={{ cursor: "pointer" }}>
                {words.aiHistoryTitle}
              </summary>

              {turns !== null && turns.length === 0 ? (
                <p className="small" style={{ marginTop: 8 }}>{words.aiHistoryEmpty}</p>
              ) : null}

              {turns?.map((turn, at) => (
                <div key={at} style={{ marginTop: 10 }}>
                  <p style={{ margin: 0, fontWeight: 500 }}>{turn.request}</p>
                  <p className="small" style={{ margin: "2px 0 0 0" }}>{turn.reply}</p>
                </div>
              ))}

              {turns !== null && turns.length > 0 ? (
                <button
                  type="button"
                  className="compact"
                  style={{ marginTop: 12 }}
                  disabled={busy}
                  onClick={async () => {
                    const id = live.current.noteId ?? noteId;
                    if (id) await clearAction(id);
                    setTurns([]);
                  }}
                >
                  {words.aiForgetHistory}
                </button>
              ) : null}
            </details>
          </>
        )}
      </div>
    </details>
  );
}
