"use client";

/*
  Przełącznik motywu w nagłówku: jeden przycisk ze znakiem obecnego motywu.

  Kliknięcie przechodzi do następnego w kółko: jak w systemie -> jasny ->
  ciemny -> jak w systemie. Domyślny jest systemowy i wciąż da się do niego
  wrócić, bo cykl przez niego przechodzi - dlatego jeden przycisk wystarcza
  zamiast trzech obok siebie. Który motyw jest teraz, mówi znak na przycisku
  i podpowiedź pod kursorem.
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
    z <head>, więc dopisuje się tu tylko znak na przycisku.
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

  const at = THEME_CHOICES.findIndex((entry) => entry.id === choice);
  const now = THEME_CHOICES[at === -1 ? 0 : at];
  const next = THEME_CHOICES[(at === -1 ? 0 : at + 1) % THEME_CHOICES.length];

  function step() {
    setChoice(next.id);
    applyTheme(next.id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next.id);
    } catch {
      // Bez pamięci wybór działa do zamknięcia karty. Lepsze to niż błąd.
    }
  }

  return (
    <div className="theme-switch" role="group" aria-label={words.themeLabel}>
      <button
        type="button"
        // Podpowiedź mówi, co jest teraz - tego szuka ktoś, kto chce się
        // upewnić, a nie zmieniać. Czytnik ekranu dostaje to samo.
        title={themeOf(words, themeName(now.id))}
        aria-label={themeOf(words, themeName(now.id))}
        onClick={step}
      >
        <Icon name={now.icon} size={18} filled />
      </button>
    </div>
  );
}
