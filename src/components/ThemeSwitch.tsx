"use client";

/*
  Przełącznik motywu w nagłówku: „jak w systemie", jasny, ciemny.

  Trzy przyciski zamiast jednego przełącznika, bo „systemowy" to osobny stan,
  a nie brak wyboru - po wybraniu jasnego trzeba mieć jak wrócić do systemu.
*/

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useWords } from "@/components/LanguageProvider";
import { themeOf } from "@/lib/i18n";
import {
  applyTheme,
  knownTheme,
  THEME_CHOICES,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from "@/lib/theme";

export function ThemeSwitch() {
  const words = useWords();

  /*
    Zaczynamy od „systemowego", bo tyle wie serwer. Zapisany wybór dojeżdża
    zaraz po wczytaniu - barwy strony ma już wtedy dobre, bo postawił je skrypt
    z <head>, więc dopisuje się tu tylko obwódka na właściwym przycisku.
  */
  const [choice, setChoice] = useState<ThemeChoice>("system");

  function themeName(id: ThemeChoice): string {
    if (id === "light") return words.themeLight;
    if (id === "dark") return words.themeDark;
    return words.themeSystem;
  }

  useEffect(() => {
    try {
      setChoice(knownTheme(localStorage.getItem(THEME_STORAGE_KEY)));
    } catch {
      // Prywatne okno bez pamięci - zostaje motyw systemowy.
    }

    // Wybór w innej karcie tej samej przeglądarki obowiązuje i tutaj.
    const follow = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const next = knownTheme(event.newValue);
      setChoice(next);
      applyTheme(next);
    };
    window.addEventListener("storage", follow);
    return () => window.removeEventListener("storage", follow);
  }, []);

  function pick(next: ThemeChoice) {
    setChoice(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Bez pamięci wybór działa do zamknięcia karty. Lepsze to niż błąd.
    }
  }

  return (
    <div className="theme-switch" role="group" aria-label={words.themeLabel}>
      {THEME_CHOICES.map((entry) => (
        <button
          key={entry.id}
          type="button"
          title={themeOf(words, themeName(entry.id))}
          aria-label={themeName(entry.id)}
          aria-pressed={choice === entry.id}
          className={choice === entry.id ? "on" : undefined}
          onClick={() => pick(entry.id)}
        >
          <Icon name={entry.icon} size={18} filled={choice === entry.id} />
        </button>
      ))}
    </div>
  );
}
