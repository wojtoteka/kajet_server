import { describe, expect, it } from "vitest";
import { titleFromMarkdown, titleFromMindMap } from "./note-title";

describe("tytuł podpowiedziany z treści", () => {
  it("bierze pierwszy wiersz", () => {
    expect(titleFromMarkdown("Lista zakupów\nmleko\nchleb")).toBe("Lista zakupów");
  });

  it("nie nazywa notatki od wiersza pisanego w tej chwili", () => {
    // Autozapis rusza ułamek sekundy po pierwszym znaku - „L" nie może zostać
    // tytułem notatki na zawsze.
    expect(titleFromMarkdown("L")).toBeNull();
    expect(titleFromMarkdown("Lista")).toBeNull();
    // Dość długi wiersz mówi już, o czym to jest, nawet bez Entera.
    expect(titleFromMarkdown("Lista zakupów na sobotę")).toBe("Lista zakupów na sobotę");
    // Enter znaczy „ten wiersz mam skończony".
    expect(titleFromMarkdown("Lista\n")).toBe("Lista");
  });

  it("pomija puste wiersze na początku", () => {
    expect(titleFromMarkdown("\n\n   \nWłaściwa treść")).toBe("Właściwa treść");
  });

  it("z nagłówka zdejmuje kratki", () => {
    expect(titleFromMarkdown("## Zebranie w piątek\n\ntreść")).toBe("Zebranie w piątek");
  });

  it("z pozycji listy zdejmuje znaczek", () => {
    expect(titleFromMarkdown("- kupić mleko\n")).toBe("kupić mleko");
    expect(titleFromMarkdown("1. pierwszy punkt\n")).toBe("pierwszy punkt");
    expect(titleFromMarkdown("- [ ] zadanie do zrobienia\n")).toBe("zadanie do zrobienia");
  });

  it("z cytatu też", () => {
    expect(titleFromMarkdown("> tak powiedział\n")).toBe("tak powiedział");
  });

  it("zdejmuje pogrubienie, kursywę i kolor", () => {
    expect(titleFromMarkdown("**Ważne** i *pilne*\n")).toBe("Ważne i pilne");
    expect(titleFromMarkdown('<span style="color:#c81e1e">Czerwone</span> słowo')).toBe(
      "Czerwone słowo",
    );
    expect(titleFromMarkdown("<u>Podkreślone</u>\n")).toBe("Podkreślone");
    expect(titleFromMarkdown("`kod` w zdaniu\n")).toBe("kod w zdaniu");
  });

  it("zdejmuje też rozmiar pisma i zagnieżdżone znaczniki", () => {
    expect(titleFromMarkdown('<span style="font-size:21px">Duże słowa</span> w zdaniu')).toBe(
      "Duże słowa w zdaniu",
    );
    // Enter na końcu: wiersz jest dokończony, choć po zdjęciu znaczników
    // zostaje mniej niż dwanaście znaków.
    expect(
      titleFromMarkdown(
        '# <span style="font-size:21px"><span style="color:#665222">Ważne</span></span> słowo\n',
      ),
    ).toBe("Ważne słowo");
  });

  it("z odnośnika zostaje sam opis", () => {
    expect(titleFromMarkdown("[Kajet](https://kajet.wojtoteka.ovh) to notatnik")).toBe(
      "Kajet to notatnik",
    );
  });

  it("przechodzi nad blokiem kodu i wzorem", () => {
    expect(titleFromMarkdown("```\nprint(1)\n```\nOpis programu")).toBe("Opis programu");
    expect(titleFromMarkdown("$$\na+b\n$$\nWzór na sumę")).toBe("Wzór na sumę");
  });

  it("pomija linię poziomą", () => {
    expect(titleFromMarkdown("---\nTreść pod linią")).toBe("Treść pod linią");
  });

  it("obcina bardzo długi wiersz", () => {
    const long = "słowo ".repeat(40).trim();
    const title = titleFromMarkdown(long);
    expect(title).not.toBeNull();
    // 48 znaków granicy plus wielokropek.
    expect(title!.length).toBeLessThanOrEqual(51);
    expect(title!.endsWith("...")).toBe(true);
  });

  it("tnie na spacji, nie w połowie słowa", () => {
    const zdanie =
      "Pomaganie drugiemu człowiekowi to jedna z najważniejszych wartości w życiu.";
    const title = titleFromMarkdown(zdanie)!;

    expect(title.endsWith("...")).toBe(true);
    // Ostatnie słowo przed wielokropkiem musi być całe - „...z najważn" czyta
    // się jak usterka, a nie jak tytuł.
    const bezKropek = title.slice(0, -3);
    expect(zdanie.startsWith(bezKropek)).toBe(true);
    expect(zdanie[bezKropek.length]).toBe(" ");
  });

  it("jedno słowo dłuższe niż cała granica tniemy równo", () => {
    // Nie ma gdzie ciąć - inaczej tytuł zostałby pusty.
    const title = titleFromMarkdown("a".repeat(120))!;
    expect(title).toBe(`${"a".repeat(48)}...`);
  });

  it("krótki wiersz zostaje bez wielokropka", () => {
    expect(titleFromMarkdown("Zakupy na sobotę")).toBe("Zakupy na sobotę");
  });

  it("pusta treść nie daje tytułu", () => {
    expect(titleFromMarkdown("")).toBeNull();
    expect(titleFromMarkdown("\n\n   \n")).toBeNull();
    expect(titleFromMarkdown("```\nsam kod\n```")).toBeNull();
    // Samo zdjęcie bez opisu też nie ma czego nazwać.
    expect(titleFromMarkdown("![](assets/kot.png)")).toBeNull();
  });

  it("mapa myśli bierze pierwszy opisany węzeł", () => {
    expect(titleFromMindMap([{ text: "" }, { text: "  " }, { text: "Plan roku" }])).toBe(
      "Plan roku",
    );
    expect(titleFromMindMap([])).toBeNull();
    expect(titleFromMindMap([{ text: "**Środek** mapy" }])).toBe("Środek mapy");
  });
});
