"use client";

/*
  Własne okno potwierdzenia zamiast window.confirm. Przeglądarkowe okno
  podpisuje pytanie adresem strony („Strona ... mówi:") i wygląda obco -
  to tutaj leży na tej samej kartce co reszta panelu.

  Escape i kliknięcie obok okna znaczą „Anuluj". Skupienie zaczyna na
  bezpiecznym przycisku, żeby przypadkowy Enter niczego nie skasował.
*/

import { useEffect } from "react";
import { useWords } from "@/components/LanguageProvider";

export function ConfirmDialog({
  question,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  question: string;
  /** Podpis przycisku zgody - najlepiej nazwa działania, np. „Skasuj konto". */
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const words = useWords();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="confirm-veil"
      role="dialog"
      aria-modal="true"
      aria-label={words.confirmationLabel}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="confirm-box">
        <p className="eyebrow">{words.areYouSure}</p>
        <p className="confirm-question">{question}</p>
        <div className="confirm-actions">
          <button type="button" onClick={onCancel} autoFocus>
            Anuluj
          </button>
          <button
            type="button"
            className={danger ? "danger" : "primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
