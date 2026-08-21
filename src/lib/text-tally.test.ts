/*
  Licznik słów i znaków.

  Sedno: liczy się to, co widać na kartce, a nie zapis. Do tej pory pod
  edytorem stała długość surowego markdownu, więc jedno pokolorowane słowo
  potrafiło dołożyć czterdzieści znaków.

  Te same przypadki mają być w teście po stronie aplikacji - obie strony muszą
  dać dla tej samej notatki tę samą liczbę.
*/

import { describe, expect, it } from "vitest";
import { tally } from "./text-tally";

describe("licznik", () => {
  it("liczy zwykłe zdanie", () => {
    const t = tally("Ala ma kota.");
    expect(t.words).toBe(3);
    expect(t.chars).toBe(12);
    expect(t.charsNoSpaces).toBe(10);
  });

  it("nie liczy gwiazdek pogrubienia ani kursywy", () => {
    expect(tally("**Ala** ma *kota*.")).toMatchObject({ words: 3, chars: 12 });
  });

  it("nie liczy znacznika barwy - to on rozdymał dawną liczbę", () => {
    const kolorowe = 'Ala ma <span style="color:#b0322a">kota</span>.';
    expect(kolorowe.length).toBeGreaterThan(40);
    expect(tally(kolorowe)).toMatchObject({ words: 3, chars: 12 });
  });

  it("nie liczy podkreślenia ani zakreślenia", () => {
    expect(tally("<u>Ala</u> ma ==kota==.")).toMatchObject({ words: 3, chars: 12 });
  });

  it("z odnośnika liczy sam napis, bez adresu", () => {
    expect(tally("Zobacz [mapę](https://example.com/bardzo/dluga/sciezka)")).toMatchObject({
      words: 2,
      chars: 11,
    });
  });

  it("zdjęcia nie liczy wcale", () => {
    expect(tally("![kot na płocie|60%](assets/kot.png)")).toMatchObject({ words: 0, chars: 0 });
  });

  it("nie liczy kratek nagłówka ani znaczników listy", () => {
    const notatka = ["# Zakupy", "", "- mleko", "- chleb"].join("\n");
    expect(tally(notatka).words).toBe(3);
  });

  it("nie liczy kwadracików zadań", () => {
    expect(tally("- [ ] kupić mleko\n- [x] oddać książkę").words).toBe(4);
  });

  it("z tabeli liczy same komórki, bez kresek", () => {
    const tabela = ["| imię | wiek |", "| --- | --- |", "| Ala | 7 |"].join("\n");
    expect(tally(tabela).words).toBe(4);
  });

  it("treść bloku kodu liczy się, bo ją widać - płot nie", () => {
    const notatka = ["```", "print('hej')", "```"].join("\n");
    expect(tally(notatka).words).toBe(1);
    expect(tally(notatka).chars).toBe("print('hej')".length);
  });

  it("linia pozioma to nie tekst", () => {
    expect(tally("Ala\n\n---\n\nma kota").words).toBe(3);
  });

  it("emotikona to jeden znak, nie dwa", () => {
    // "🙂".length to 2 - liczymy punkty kodowe, nie jednostki UTF-16.
    expect(tally("🙂").chars).toBe(1);
  });

  it("pusta notatka to same zera", () => {
    expect(tally("")).toEqual({ words: 0, chars: 0, charsNoSpaces: 0, paragraphs: 0 });
    expect(tally("\n\n   \n")).toMatchObject({ words: 0, paragraphs: 0 });
  });

  it("sama interpunkcja nie jest słowem", () => {
    expect(tally("- … ***").words).toBe(0);
  });

  it("liczy akapity po pustym wierszu", () => {
    expect(tally("Pierwszy akapit.\n\nDrugi akapit.\n\nTrzeci.").paragraphs).toBe(3);
  });

  it("złamanie wiersza nie liczy się jako znak", () => {
    expect(tally("ab\ncd").chars).toBe(4);
  });

  it("liczby są słowami, tak samo jak wyrazy", () => {
    expect(tally("W 1410 roku").words).toBe(3);
  });
});
