"use client";

/*
  Przełącznik języka w nagłówku: polski albo angielski.

  Wybór idzie do ciasteczka, nie do localStorage - napisy składa serwer, więc
  musi go poznać przed wysłaniem strony. Zaraz po zapisaniu odświeżamy widok
  (`router.refresh()`), żeby strona przyszła od nowa już w nowym języku.
*/

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  LANGUAGE_CHOICES,
  LANGUAGE_COOKIE,
  LANGUAGE_MAX_AGE,
  type Language,
} from "@/lib/i18n";

export function LanguageSwitch({ current }: { current: Language }) {
  const router = useRouter();
  const [busy, start] = useTransition();

  function pick(next: Language) {
    if (next === current) return;
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie =
      `${LANGUAGE_COOKIE}=${next}` +
      `; path=/; max-age=${LANGUAGE_MAX_AGE}; samesite=lax${secure}`;
    start(() => router.refresh());
  }

  return (
    <div className="theme-switch" role="group" aria-label="Język strony / Page language">
      {LANGUAGE_CHOICES.map((entry) => (
        <button
          key={entry.id}
          type="button"
          // Skrót na przycisku, pełna nazwa w podpowiedzi - w nagłówku nie ma
          // miejsca na „Polski” i „English” obok trzech przycisków motywu.
          title={entry.label}
          aria-label={entry.label}
          aria-pressed={current === entry.id}
          className={current === entry.id ? "on" : undefined}
          disabled={busy}
          onClick={() => pick(entry.id)}
          style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em" }}
        >
          {entry.id.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
