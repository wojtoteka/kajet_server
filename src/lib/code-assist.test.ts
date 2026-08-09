import { describe, expect, it } from "vitest";
import { assistKey } from "./code-assist";

/*
  Pomoc przy pisaniu kodu w panelu WWW. Te same przypadki, co CodeAssistTest
  w aplikacji - obie strony mają zachowywać się identycznie.
*/

const at = (text: string, key: string, html = false) => {
  const start = text.indexOf("|");
  const clean = text.replace("|", "");
  return assistKey({ key, text: clean, start, end: start, html });
};

describe("domykanie par", () => {
  it("dostawia domknięcie i zostawia kursor w środku", () => {
    expect(at("print|", "(")).toEqual({ kind: "insert", text: "()", caretBack: 1 });
  });

  it("domyka też przed odstępem i przed innym domknięciem", () => {
    expect(at("f(|)", "[")).toEqual({ kind: "insert", text: "[]", caretBack: 1 });
    expect(at("a | b", "{")).toEqual({ kind: "insert", text: "{}", caretBack: 1 });
  });

  it("nie domyka przed słowem", () => {
    // „(" przed istniejącym wyrażeniem to zwykle początek obejmowania go
    // nawiasem - domknięcie w środku tylko by przeszkadzało.
    expect(at("|wartosc", "(")).toBeNull();
  });

  it("nie robi z apostrofu w słowie pary", () => {
    expect(at("don|", "'")).toBeNull();
    expect(at("|", "'")).toEqual({ kind: "insert", text: "''", caretBack: 1 });
  });

  it("zaznaczenie obejmuje parą zamiast je kasować", () => {
    const wrapped = assistKey({ key: '"', text: "ala ma kota", start: 4, end: 6, html: false });
    expect(wrapped).toEqual({ kind: "insert", text: '"ma"', caretBack: 1 });
  });
});

describe("przechodzenie i kasowanie", () => {
  it("przepuszcza kursor przez stojące już domknięcie", () => {
    expect(at("print(|)", ")")).toEqual({ kind: "skip" });
  });

  it("dopisuje domknięcie, którego nie ma", () => {
    expect(at("print(x|", ")")).toBeNull();
  });

  it("kasuje pustą parę jednym cofnięciem", () => {
    expect(at("print(|)", "Backspace")).toEqual({ kind: "deletePair" });
  });

  it("cofnięcie w niepustej parze kasuje jeden znak", () => {
    expect(at("print(x|)", "Backspace")).toBeNull();
  });
});

describe("znaczniki HTML", () => {
  it("domyka znacznik po wpisaniu >", () => {
    expect(at("<p|", ">", true)).toEqual({ kind: "insert", text: "></p>", caretBack: 4 });
  });

  it("radzi sobie z nazwami z cyfrą", () => {
    expect(at("<h1|", ">", true)).toEqual({ kind: "insert", text: "></h1>", caretBack: 5 });
    expect(at("<h2|", ">", true)).toEqual({ kind: "insert", text: "></h2>", caretBack: 5 });
  });

  it("bierze pod uwagę atrybuty", () => {
    expect(at('<div class="x"|', ">", true)).toEqual({
      kind: "insert",
      text: "></div>",
      caretBack: 6,
    });
  });

  it("zostawia w spokoju znaczniki bez domknięcia", () => {
    expect(at("<br|", ">", true)).toBeNull();
    expect(at("<img src=a|", ">", true)).toBeNull();
  });

  it("nie domyka domknięcia ani znacznika domkniętego samodzielnie", () => {
    expect(at("</p|", ">", true)).toBeNull();
    expect(at("<hr /|", ">", true)).toBeNull();
  });

  it("w innych językach > jest zwykłym znakiem", () => {
    expect(at("<p|", ">", false)).toBeNull();
    expect(at("if a <b|", ">", false)).toBeNull();
    expect(at("const x: Array<string|", ">", false)).toBeNull();
  });

  it("dlatego domykanie znaczników zostaje przy samym HTML-u", () => {
    // Gdyby ta reguła weszła do JS-a i TS-a, generyki dostawałyby domknięcie:
    // `Array<string>` zamieniałoby się w `Array<string></string>`.
    expect(at("const x: Array<string|", ">", true)).toEqual({
      kind: "insert",
      text: "></string>",
      caretBack: 9,
    });
  });
});

describe("wcięcie po Enterze", () => {
  it("przepisuje wcięcie z bieżącego wiersza", () => {
    expect(at("def f():\n    return 1|", "Enter")).toEqual({
      kind: "insert",
      text: "\n    ",
      caretBack: 0,
    });
  });

  it("bez wcięcia nie ma czego przepisywać", () => {
    expect(at("print(1)|", "Enter")).toBeNull();
  });
});

describe("czego nie ruszamy", () => {
  it("skróty klawiszowe i strzałki idą bokiem", () => {
    expect(at("kod|", "ArrowLeft")).toBeNull();
    expect(at("kod|", "Tab")).toBeNull();
  });
});
