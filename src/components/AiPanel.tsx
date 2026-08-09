"use client";

import { useState, useTransition } from "react";
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

  Cofnięcie działa na treści, którą trzymamy w pamięci przeglądarki OD PRZED
  zmiany. Nie ma osobnej ścieżki „przywróć" na serwerze: stara treść wraca
  zwykłym zapisem, jako kolejna wersja notatki.
*/

type Turn = { request: string; reply: string };

export function AiPanel({
  noteId,
  version,
  contentBefore,
  consented,
  askAction,
  undoAction,
  historyAction,
  clearAction,
}: {
  noteId: string;
  version: number;
  /** Treść notatki teraz - to do niej wraca „Cofnij". */
  contentBefore: string;
  consented: boolean;
  askAction: (noteId: string, instruction: string, baseVersion: number) => Promise<AiAnswer>;
  undoAction: (noteId: string, content: string, baseVersion: number) => Promise<AiAnswer>;
  historyAction: (noteId: string) => Promise<Turn[]>;
  clearAction: (noteId: string) => Promise<boolean>;
}) {
  const words = useWords();
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  const [instruction, setInstruction] = useState("");
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [undoneAt, setUndoneAt] = useState<number | null>(null);
  const [turns, setTurns] = useState<Turn[] | null>(null);

  if (!consented) {
    return (
      <section className="sheet ai-panel">
        <p className="eyebrow">{words.aiTitle}</p>
        <p className="lead" style={{ margin: "6px 0 12px 0" }}>
          {words.aiNeedsConsent}
        </p>
        <Link className="button compact" href="/account#asystent">
          {words.aiGoToAccount}
        </Link>
      </section>
    );
  }

  /** Wersja, na której stoi kolejny zapis: po zmianie asystenta ta nowa. */
  const currentVersion = answer?.status === "zmieniono" ? answer.version : version;

  function ask() {
    const asked = instruction.trim();
    if (!asked) return;
    startTransition(async () => {
      const result = await askAction(noteId, asked, currentVersion);
      setAnswer(result);
      setUndoneAt(null);
      // Pole czyści się dopiero po UDANEJ zmianie - po błędzie polecenie ma
      // zostać, żeby dało się poprawić jedno słowo i spróbować znowu.
      if (result.status === "zmieniono") {
        setInstruction("");
        router.refresh();
      }
      if (turns !== null) setTurns(await historyAction(noteId));
    });
  }

  function undo() {
    startTransition(async () => {
      const result = await undoAction(noteId, contentBefore, currentVersion);
      if (result.status === "zmieniono") {
        setAnswer(null);
        setUndoneAt(Date.now());
        router.refresh();
      } else if (result.status === "blad") {
        setAnswer(result);
      }
    });
  }

  return (
    <section className="sheet ai-panel">
      <p className="eyebrow">{words.aiTitle}</p>

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
    </section>
  );
}
