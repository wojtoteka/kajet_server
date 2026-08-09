/*
  Nadawanie tytułu przez asystenta.

  Reguła, o którą tu chodzi: tytuł napisany przez CZŁOWIEKA jest nietykalny,
  a „Bez nazwy" i tytuł podpowiedziany z treści asystent może zastąpić.

  Informacji „ten tytuł wpisał człowiek" nie ma nigdzie - ani w bazie, ani
  w pliku notatki - więc rozstrzyga to porównanie z tym, co dałaby dzisiejsza
  treść. To heurystyka, ale myli się w bezpieczną stronę: gdy nie jest pewna,
  uznaje tytuł za własny i go NIE rusza.
*/

import { describe, expect, it } from "vitest";
import { applyAiCall } from "./apply";
import { titleIsOwn } from "@/lib/note-title";
import { buildTextNoteContent } from "@/lib/text-note";
import { NAZWA_TEKST } from "./tools";

const NOTE_ID = "n1";

function notatka(title: string, markdown: string) {
  return buildTextNoteContent({ id: NOTE_ID, title, markdown });
}

function popros(title: string, markdown: string, args: Record<string, unknown>) {
  return applyAiCall({
    kind: "TEXT",
    noteId: NOTE_ID,
    title,
    content: notatka(title, markdown),
    toolName: NAZWA_TEKST,
    args,
  });
}

describe("czyj to tytuł", () => {
  it('„Bez nazwy” nie jest tytułem człowieka', () => {
    expect(titleIsOwn("Bez nazwy", null)).toBe(false);
    expect(titleIsOwn("Untitled", null)).toBe(false);
    expect(titleIsOwn("", null)).toBe(false);
  });

  it("tytuł równy pierwszemu wierszowi treści pochodzi z podpowiedzi", () => {
    expect(titleIsOwn("Zakupy na sobotę", "Zakupy na sobotę")).toBe(false);
  });

  it("nazwa pliku nadana przez program nie jest tytułem człowieka", () => {
    expect(titleIsOwn("program.py", null)).toBe(false);
    expect(titleIsOwn("main.kt", null)).toBe(false);
  });

  it("wszystko inne uchodzi za tytuł człowieka", () => {
    expect(titleIsOwn("Sprawdzian z historii", "Zupełnie co innego")).toBe(true);
    // Poprawiony pierwszy wiersz - porównanie już nie gra, więc tytuł jest
    // uznany za własny. Pomyłka w bezpieczną stronę.
    expect(titleIsOwn("Zakupy na sobotę", "Zakupy na niedzielę")).toBe(true);
    expect(titleIsOwn("analiza-danych.py", null)).toBe(true);
  });
});

describe("asystent a tytuł notatki", () => {
  it("nadaje tytuł notatce bez nazwy", () => {
    const wynik = popros("Bez nazwy", "", {
      markdown: "Fotosynteza to proces...",
      opis: "Napisano notatkę o fotosyntezie.",
      tytul: "Fotosynteza",
    });

    expect(wynik.kind).toBe("zmiana");
    if (wynik.kind !== "zmiana") return;
    expect(wynik.title).toBe("Fotosynteza");
    // Tytuł musi wejść TAKŻE do treści notatki - inaczej spis i wnętrze
    // rozjadą się i przy najbliższej synchronizacji jedno nadpisze drugie.
    expect(wynik.content).toContain("Fotosynteza");
  });

  it("zastępuje tytuł podpowiedziany z treści", () => {
    const wynik = popros("Zakupy na sobotę", "Zakupy na sobotę\n\n- mleko", {
      markdown: "Zakupy na sobotę\n\n- mleko\n- chleb",
      opis: "Dopisano chleb.",
      tytul: "Lista zakupów",
    });

    expect(wynik.kind).toBe("zmiana");
    if (wynik.kind !== "zmiana") return;
    expect(wynik.title).toBe("Lista zakupów");
  });

  it("NIE rusza tytułu napisanego przez człowieka", () => {
    const wynik = popros("Sprawdzian z historii", "Zadanie 1. Kiedy była bitwa?", {
      markdown: "Zadanie 1. Kiedy była bitwa?\n1410",
      opis: "Rozwiązano zadanie pierwsze.",
      tytul: "Bitwa pod Grunwaldem",
    });

    expect(wynik.kind).toBe("zmiana");
    if (wynik.kind !== "zmiana") return;
    // To jego notatka, nie modelu.
    expect(wynik.title).toBe("Sprawdzian z historii");
  });

  it("bez pola tytul tytuł zostaje taki, jaki był", () => {
    const wynik = popros("Bez nazwy", "coś", {
      markdown: "coś więcej",
      opis: "Dopisano zdanie.",
    });

    expect(wynik.kind).toBe("zmiana");
    if (wynik.kind !== "zmiana") return;
    expect(wynik.title).toBe("Bez nazwy");
  });

  it('sama zmiana tytułu to też zmiana, a nie „nic nie zrobiono”', () => {
    const wynik = popros("Bez nazwy", "Fotosynteza to proces...", {
      markdown: "Fotosynteza to proces...",
      opis: "Nadano tytuł.",
      tytul: "Fotosynteza",
    });

    expect(wynik.kind).toBe("zmiana");
  });

  it("za długi tytuł od modelu zostaje przycięty, a nie odrzucony", () => {
    const wynik = popros("Bez nazwy", "treść", {
      markdown: "treść dłuższa",
      opis: "Dopisano.",
      tytul: "słowo ".repeat(60).trim(),
    });

    expect(wynik.kind).toBe("zmiana");
    if (wynik.kind !== "zmiana") return;
    expect(wynik.title.length).toBeLessThanOrEqual(120);
  });
});
