"use client";

/*
  Przełącznik języka w nagłówku: flaga w kółku, obok nazwa i daszek, a po
  kliknięciu krótka lista do wyboru. Na telefonie nazwa kurczy się do skrótu
  („PL", „EN"), bo na wąskim pasku nie ma miejsca na pełną - w rozwiniętej
  liście języki zawsze podpisane są pełnym imieniem.

  Wybór idzie do ciasteczka, nie do localStorage - napisy składa serwer, więc
  musi go poznać przed wysłaniem strony. Zaraz po zapisaniu odświeżamy widok
  (`router.refresh()`), żeby strona przyszła od nowa już w nowym języku.
*/

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  LANGUAGE_CHOICES,
  LANGUAGE_COOKIE,
  LANGUAGE_MAX_AGE,
  type Language,
} from "@/lib/i18n";

/*
  Flagi leżą w `public` jako prostokąty 3:2. Kółko robimy kadrowaniem środka:
  `object-fit: cover` w kwadratowej ramce z `border-radius: 50%`, więc z flagi
  zostaje środek bez ściśnięcia proporcji.
*/
const FLAG_FILE: Record<Language, string> = {
  pl: "/polish.webp",
  en: "/english.webp",
};

function Flag({ language, size }: { language: Language; size: number }) {
  return (
    <img
      src={FLAG_FILE[language]}
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        // Cienka obwódka, żeby biały pas polskiej flagi nie zlewał się z jasnym
        // tłem nagłówka i kółko miało krawędź w obu motywach.
        boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.18)",
      }}
    />
  );
}

export function LanguageSwitch({ current }: { current: Language }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Klik poza listą i Escape zamykają wybór - inaczej lista zostawałaby
  // otwarta po odejściu myszą i zasłaniała nagłówek.
  useEffect(() => {
    if (!open) return;

    const outside = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  function pick(next: Language) {
    setOpen(false);
    if (next === current) return;
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie =
      `${LANGUAGE_COOKIE}=${next}` +
      `; path=/; max-age=${LANGUAGE_MAX_AGE}; samesite=lax${secure}`;
    start(() => router.refresh());
  }

  const chosen = LANGUAGE_CHOICES.find((entry) => entry.id === current) ?? LANGUAGE_CHOICES[0];

  return (
    <div className="language-pick" ref={box}>
      <button
        type="button"
        className="language-current"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={chosen.label}
        disabled={busy}
        onClick={() => setOpen((was) => !was)}
      >
        <Flag language={chosen.id} size={22} />
        {/* Pełna nazwa i skrót stoją oba w przycisku, a arkusz pokazuje ten,
            na który jest miejsce: „Polski" na szerokim ekranie, „PL" na
            telefonie. Czytnik ekranu dostaje pełną nazwę z aria-label
            przycisku, więc żaden z tych napisów nic mu nie odbiera. */}
        <span className="language-name">{chosen.label}</span>
        <span className="language-short" aria-hidden>
          {chosen.short}
        </span>
        <span className="language-caret" aria-hidden />
      </button>

      {open ? (
        <div className="language-list" role="listbox" aria-label={chosen.label}>
          {LANGUAGE_CHOICES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="option"
              aria-selected={current === entry.id}
              className={current === entry.id ? "on" : undefined}
              onClick={() => pick(entry.id)}
            >
              <Flag language={entry.id} size={20} />
              <span>{entry.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
