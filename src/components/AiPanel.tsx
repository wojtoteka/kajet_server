"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useWords } from "@/components/LanguageProvider";
import type { AiAnswer } from "@/app/note/[id]/actions";

/*
  Panel asystenta w panelu WWW - ten sam, co w aplikacji, tylko w przeglądarce.

  Pokazuje się WYŁĄCZNIE przy koncie z uprawnieniem; rozstrzyga to strona
  notatki, zanim go w ogóle wyrenderuje. Tu nie ma zapasowej bramki, bo
  prawdziwa i tak stoi na serwerze - ukrycie pola nigdy nie było
  zabezpieczeniem.

  Panel stoi POD edytorem i jest domyślnie zwinięty. Wcześniej siedział nad
  notatką, zawsze otwarty, i zabierał dwieście pikseli, zanim widać było
  pierwszą literę.

  Cofnięcie działa na treści zapamiętanej W CHWILI WYSYŁANIA POLECENIA, a nie
  na tej z propsa. Props po odświeżeniu strony niesie już treść PO zmianie -
  cofanie do niej wysyłało to samo, co jest, serwer stwierdzał brak zmian,
  a panel i tak meldował sukces. Nie ma osobnej ścieżki „przywróć" na serwerze:
  stara treść wraca zwykłym zapisem, jako kolejna wersja notatki.
*/

type Turn = { request: string; reply: string };

export type AiPanelProps = {
  noteId: string;
  version: number;
  /** Treść notatki teraz - to od niej zaczyna się „Cofnij" przy najbliższej prośbie. */
  contentBefore: string;
  consented: boolean;
  askAction: (noteId: string, instruction: string, baseVersion: number) => Promise<AiAnswer>;
  undoAction: (noteId: string, content: string, baseVersion: number) => Promise<AiAnswer>;
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
  contentBefore,
  consented,
  askAction,
  undoAction,
  historyAction,
  clearAction,
  onApplied,
}: AiPanelProps) {
  const words = useWords();
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  const [instruction, setInstruction] = useState("");
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [undoneAt, setUndoneAt] = useState<number | null>(null);
  const [turns, setTurns] = useState<Turn[] | null>(null);

  /** Treść sprzed ostatniej prośby. To do niej wraca „Cofnij". */
  const before = useRef<string | null>(null);

  /** Wersja, na której stoi kolejny zapis: po zmianie asystenta ta nowa. */
  const currentVersion = answer?.status === "zmieniono" ? answer.version : version;

  function ask() {
    const asked = instruction.trim();
    if (!asked) return;
    // Migawka PRZED wysłaniem - potem props już nie będzie tym, czym był.
    before.current = contentBefore;
    startTransition(async () => {
      const result = await askAction(noteId, asked, currentVersion);
      setAnswer(result);
      setUndoneAt(null);
      // Pole czyści się dopiero po UDANEJ zmianie - po błędzie polecenie ma
      // zostać, żeby dało się poprawić jedno słowo i spróbować znowu.
      if (result.status === "zmieniono") {
        setInstruction("");
        onApplied?.(result.version);
        router.refresh();
      }
      if (turns !== null) setTurns(await historyAction(noteId));
    });
  }

  function undo() {
    const back = before.current ?? contentBefore;
    startTransition(async () => {
      const result = await undoAction(noteId, back, currentVersion);
      if (result.status === "zmieniono") {
        setAnswer(null);
        setUndoneAt(Date.now());
        before.current = null;
        onApplied?.(result.version);
        router.refresh();
      } else if (result.status === "blad") {
        setAnswer(result);
      }
    });
  }

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

              {answer?.status === "zmieniono" ? (
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
                if ((event.target as HTMLDetailsElement).open && turns === null) {
                  setTurns(await historyAction(noteId));
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
                  onClick={() =>
                    startTransition(async () => {
                      await clearAction(noteId);
                      setTurns([]);
                    })
                  }
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
