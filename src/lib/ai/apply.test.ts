/*
  Poprawka od modelu w drodze do treści notatki.

  Dwie rzeczy są tu ważniejsze od reszty:

   - pola, o których model nic nie wie, mają przeżyć zmianę. Rysunek wstawiony
     do notatki tekstowej, pismo odręczne w węźle mapy, znaczniki i data
     powstania nie jadą do modelu, więc jedyne, co je chroni, to składanie
     nowej treści istniejącym budowniczym,
   - byle co od modelu nie ma prawa się zapisać. Zły kształt, pusty opis,
     rozmiar pisma spoza skali - notatka zostaje nietknięta.
*/

import { describe, expect, it } from "vitest";
import { applyAiCall } from "./apply";
import { viewForModel } from "./note-view";
import { buildTextNoteContent } from "@/lib/text-note";
import { buildCodeNoteContent } from "@/lib/code-note";
import { buildMindMapNoteContent } from "@/lib/mindmap-note";
import { readDocument } from "@/lib/document";
import type { MindEdge, MindNode } from "@/lib/document";
import { words } from "@/lib/i18n";

const NOTE_ID = "n1";
const PL = words("pl");

/** Notatka tekstowa ze zdjęciem w środku i rysunkiem w polu drawings. */
function textNote(markdown: string): string {
  const base = JSON.parse(
    buildTextNoteContent({ id: NOTE_ID, title: "Zakupy", markdown }),
  );
  base.tags = ["dom"];
  base.createdAt = 1_700_000_000_000;
  base.text.drawings = [
    { asset: "assets/rysunek-1.png", source: "{}", width: 200, height: 120 },
  ];
  base.text.fontSize = 20;
  return JSON.stringify(base);
}

function codeNote(source: string, language = "python"): string {
  return buildCodeNoteContent({ id: NOTE_ID, title: "analiza.py", language, source });
}

function mindNote(nodes: MindNode[], edges: MindEdge[]): string {
  return buildMindMapNoteContent({ id: NOTE_ID, title: "Mapa", nodes, edges });
}

describe("notatka tekstowa", () => {
  const content = textNote("# Zakupy\n\n- mleko\n\n![paragon|60%](assets/paragon.png)");

  it("zapisuje nową treść i zostawia to, czego model nie widział", () => {
    const outcome = applyAiCall({
      kind: "TEXT",
      noteId: NOTE_ID,
      title: "Zakupy",
      content,
      toolName: "zmien_tekst",
      words: PL,
      args: {
        markdown: "# Zakupy\n\n- mleko\n- chleb\n\n![paragon|60%](assets/paragon.png)",
        opis: "Dopisano chleb.",
      },
    });

    expect(outcome.kind).toBe("zmiana");
    if (outcome.kind !== "zmiana") return;

    const after = readDocument(outcome.content)!;
    expect(after.text!.markdown).toContain("- chleb");
    // Rysunek, znaczniki, data powstania i rozmiar pisma przeżyły zmianę.
    expect(after.text!.drawings).toHaveLength(1);
    expect(after.tags).toEqual(["dom"]);
    expect(after.createdAt).toBe(1_700_000_000_000);
    expect(after.text!.fontSize).toBe(20);
  });

  it("zmienia wygląd, gdy model o to poproszony podał pola", () => {
    const outcome = applyAiCall({
      kind: "TEXT",
      noteId: NOTE_ID,
      title: "Zakupy",
      content,
      toolName: "zmien_tekst",
      words: PL,
      args: { markdown: "# Zakupy", opis: "Wyśrodkowano.", align: "center", font: "mono" },
    });

    expect(outcome.kind).toBe("zmiana");
    if (outcome.kind !== "zmiana") return;
    const after = readDocument(outcome.content)!;
    expect(after.text!.align).toBe("center");
    expect(after.text!.font).toBe("mono");
  });

  it("odrzuca opis pusty i rozmiar pisma spoza skali", () => {
    const bezOpisu = applyAiCall({
      kind: "TEXT",
      noteId: NOTE_ID,
      title: "Zakupy",
      content,
      toolName: "zmien_tekst",
      words: PL,
      args: { markdown: "cokolwiek", opis: "   " },
    });
    expect(bezOpisu.kind).toBe("blad");

    const zaDuze = applyAiCall({
      kind: "TEXT",
      noteId: NOTE_ID,
      title: "Zakupy",
      content,
      toolName: "zmien_tekst",
      words: PL,
      args: { markdown: "cokolwiek", opis: "Powiększono.", fontSize: 900 },
    });
    expect(zaDuze.kind).toBe("blad");
  });

  it("mówi wprost, gdy model niczego nie zmienił", () => {
    const outcome = applyAiCall({
      kind: "TEXT",
      noteId: NOTE_ID,
      title: "Zakupy",
      content,
      toolName: "zmien_tekst",
      words: PL,
      args: {
        markdown: "# Zakupy\n\n- mleko\n\n![paragon|60%](assets/paragon.png)",
        opis: "Poprawiono.",
      },
    });

    expect(outcome.kind).toBe("blad");
    if (outcome.kind !== "blad") return;
    expect(outcome.powod).toContain("nie zmienił");
  });
});

describe("notatka z kodem", () => {
  const content = codeNote("print('czesc')\n");

  it("zapisuje nowe źródło i nie rusza języka", () => {
    const outcome = applyAiCall({
      kind: "CODE",
      noteId: NOTE_ID,
      title: "analiza.py",
      content,
      toolName: "zmien_kod",
      words: PL,
      args: { source: "print('cześć')\n", opis: "Poprawiono polskie znaki." },
    });

    expect(outcome.kind).toBe("zmiana");
    if (outcome.kind !== "zmiana") return;
    const after = readDocument(outcome.content)!;
    expect(after.code!.source).toBe("print('cześć')\n");
    expect(after.code!.language).toBe("python");
  });

  it("nie daje się nabrać na narzędzie od innego typu notatki", () => {
    const outcome = applyAiCall({
      kind: "CODE",
      noteId: NOTE_ID,
      title: "analiza.py",
      content,
      toolName: "zmien_tekst",
      words: PL,
      args: { markdown: "wszystko jedno", opis: "Coś." },
    });

    expect(outcome.kind).toBe("blad");
  });
});

describe("mapa myśli", () => {
  const nodes: MindNode[] = [
    { id: "a", x: 0, y: 0, text: "Temat", ink: [{ id: "k1", color: -1, size: 2, points: [1, 2, 3, 4, 5, 6] }] },
    { id: "b", x: 300, y: 0, text: "Punkt" },
  ];
  const edges: MindEdge[] = [{ id: "e1", fromId: "a", toId: "b" }];
  const content = mindNote(nodes, edges);

  it("dokłada węzeł, zostawiając pismo odręczne w tym, którego nie dotknął", () => {
    const outcome = applyAiCall({
      kind: "MINDMAP",
      noteId: NOTE_ID,
      title: "Mapa",
      content,
      toolName: "zmien_mape",
      words: PL,
      args: {
        operacje: [{ rodzaj: "dodaj", id: "n1", text: "Drugi punkt", rodzicId: "a" }],
        opis: "Dodano drugi punkt.",
      },
    });

    expect(outcome.kind).toBe("zmiana");
    if (outcome.kind !== "zmiana") return;

    const after = readDocument(outcome.content)!;
    expect(after.mindMap!.nodes).toHaveLength(3);
    // Kreski w węźle „a" przeszły przez zmianę nietknięte.
    expect(after.mindMap!.nodes!.find((n) => n.id === "a")!.ink).toHaveLength(1);
  });

  it("nie zapisuje niczego, gdy operacje uszkodziłyby mapę", () => {
    const outcome = applyAiCall({
      kind: "MINDMAP",
      noteId: NOTE_ID,
      title: "Mapa",
      content,
      toolName: "zmien_mape",
      words: PL,
      args: {
        operacje: [
          { rodzaj: "zmien_tekst", id: "b", text: "Zmieniony" },
          { rodzaj: "przenies", id: "a", rodzicId: "b" },
        ],
        opis: "Przebudowano.",
      },
    });

    expect(outcome.kind).toBe("blad");
  });
});

describe("dopytanie", () => {
  it("przechodzi bez dotykania notatki", () => {
    const outcome = applyAiCall({
      kind: "TEXT",
      noteId: NOTE_ID,
      title: "Zakupy",
      content: textNote("cokolwiek"),
      toolName: "dopytaj",
      words: PL,
      args: { pytanie: "Który akapit mam skrócić?" },
    });

    expect(outcome).toEqual({ kind: "pytanie", pytanie: "Który akapit mam skrócić?" });
  });

  it("puste pytanie to błąd", () => {
    const outcome = applyAiCall({
      kind: "TEXT",
      noteId: NOTE_ID,
      title: "Zakupy",
      content: textNote("cokolwiek"),
      toolName: "dopytaj",
      words: PL,
      args: { pytanie: "" },
    });

    expect(outcome.kind).toBe("blad");
  });
});

describe("co widzi model", () => {
  it("z notatki tekstowej sam markdown", () => {
    const view = viewForModel("TEXT", textNote("# Tytuł\n\ntreść"), PL);
    expect(view).toEqual({ ok: true, material: "# Tytuł\n\ntreść", chars: 14 });
  });

  it("z mapy drzewko z identyfikatorami, bez punktów kresek", () => {
    const view = viewForModel(
      "MINDMAP",
      mindNote(
        [
          { id: "a", x: 0, y: 0, text: "Temat" },
          { id: "b", x: 0, y: 0, text: "Punkt" },
          { id: "c", x: 0, y: 0, text: "", ink: [{ id: "k", color: -1, size: 2, points: [1, 2, 3, 4, 5, 6] }] },
        ],
        [
          { id: "e1", fromId: "a", toId: "b" },
          { id: "e2", fromId: "b", toId: "c" },
        ],
      ),
      PL,
    );

    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.material).toBe(
      "[a] Temat\n  [b] Punkt\n    [c] (węzeł zapisany odręcznie)",
    );
    // Żadna liczba z tablicy points nie ma prawa tu trafić.
    expect(view.material).not.toContain("points");
  });

  it("węzeł oderwany od reszty jest wypisany, a nie przemilczany", () => {
    const view = viewForModel(
      "MINDMAP",
      mindNote(
        [
          { id: "a", x: 0, y: 0, text: "Temat" },
          { id: "z", x: 0, y: 0, text: "Sam" },
        ],
        [],
      ),
      PL,
    );

    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.material).toContain("[z] Sam");
  });
});
