/**
 * Sprawdzenie asystenta KajetAI na żywym modelu.
 *
 * Idzie całą drogą, którą chodzi punkt końcowy - system prompt, narzędzia,
 * wywołanie Gemini, walidacja odpowiedzi i złożenie nowej treści - tylko bez
 * bazy: notatki są zmyślone tutaj i nic się nie zapisuje.
 *
 * Po to jest: po wgraniu na serwer albo po zmianie klucza jednym poleceniem
 * widać, czy klucz działa, czy model odpowiada i ile to kosztuje tokenów.
 *
 * Użycie:
 *   npm run sprawdz:ai
 */

import { loadEnv } from "./database.mjs";

// Zanim cokolwiek wciągnie ustawienia: settings.ts czyta process.env raz, przy
// wczytaniu modułu, więc .env musi już wtedy stać. Stąd wczytywanie z opóźnieniem
// niżej, zamiast zwykłych importów na górze pliku.
loadEnv();

type Kind = "TEXT" | "MINDMAP" | "CODE";

main().catch((problem) => {
  console.error(problem);
  process.exit(1);
});

async function main() {
const { settings, aiWorks } = await import("../src/lib/settings");
const { askGemini } = await import("../src/lib/ai/gemini");
const { applyAiCall } = await import("../src/lib/ai/apply");
const { viewForModel } = await import("../src/lib/ai/note-view");
const { buildTextNoteContent } = await import("../src/lib/text-note");
const { buildCodeNoteContent } = await import("../src/lib/code-note");
const { buildMindMapNoteContent } = await import("../src/lib/mindmap-note");
const { readDocument } = await import("../src/lib/document");

const PROBY: { kind: Kind; title: string; content: string; instruction: string }[] = [
  {
    kind: "TEXT",
    title: "Zakupy",
    content: buildTextNoteContent({
      id: "proba-1",
      title: "Zakupy",
      markdown: "# Zakupy\n\n- mleko\n- chleb\n\n![paragon|60%](assets/paragon.png)",
    }),
    instruction: "dopisz masło na końcu listy",
  },
  {
    kind: "MINDMAP",
    title: "Wyjazd",
    content: buildMindMapNoteContent({
      id: "proba-2",
      title: "Wyjazd",
      nodes: [
        { id: "a", x: 40, y: 40, width: 160, height: 64, text: "Wyjazd" },
        { id: "b", x: 260, y: 40, width: 160, height: 64, text: "Bagaż" },
      ],
      edges: [{ id: "e1", fromId: "a", toId: "b" }],
    }),
    instruction: "dodaj pod bagażem dwa punkty: dokumenty i ładowarka",
  },
  {
    kind: "CODE",
    title: "srednia.py",
    content: buildCodeNoteContent({
      id: "proba-3",
      title: "srednia.py",
      language: "python",
      source: "liczby = [1, 2, 3]\nprint(sum(liczby) / len(liczby))\n",
    }),
    instruction: "zabezpiecz przed dzieleniem przez zero, gdy lista jest pusta",
  },
];

if (!aiWorks()) {
  console.error("Brak GEMINI_API_KEY w .env - asystent jest na tym serwerze wyłączony.");
  process.exit(1);
}

console.log(`Model: ${settings.ai.model}, myślenie: ${settings.ai.thinking}\n`);

let tokensIn = 0;
let tokensOut = 0;
let failed = 0;

for (const proba of PROBY) {
  const view = viewForModel(proba.kind, proba.content);
  if (!view.ok) {
    console.log(`${proba.kind}: nie dało się odczytać notatki - ${view.powod}\n`);
    failed += 1;
    continue;
  }

  const answer = await askGemini({
    kind: proba.kind,
    title: proba.title,
    // Próbki mają własne tytuły, więc asystent nie ma ich zmieniać.
    titleIsOwn: true,
    material: view.material,
    instruction: proba.instruction,
    history: [],
  });

  if (!answer.ok) {
    console.log(`${proba.kind}: model nie odpowiedział - ${answer.failure}\n`);
    failed += 1;
    continue;
  }

  tokensIn += answer.usage.input;
  tokensOut += answer.usage.output;

  const outcome = applyAiCall({
    kind: proba.kind,
    noteId: "proba",
    title: proba.title,
    content: proba.content,
    toolName: answer.toolName,
    args: answer.args,
  });

  console.log(`${proba.kind} - „${proba.instruction}"`);
  console.log(
    `  narzędzie: ${answer.toolName}, ${answer.tookMs} ms, ` +
      `${answer.usage.input} tokenów wejścia, ${answer.usage.output} wyjścia`,
  );

  if (outcome.kind === "blad") {
    console.log(`  ODRZUCONE: ${outcome.powod}\n`);
    failed += 1;
    continue;
  }
  if (outcome.kind === "pytanie") {
    console.log(`  asystent dopytuje: ${outcome.pytanie}\n`);
    continue;
  }

  console.log(`  ${outcome.opis}`);
  const after = readDocument(outcome.content);
  const shown =
    proba.kind === "TEXT"
      ? after?.text?.markdown
      : proba.kind === "CODE"
        ? after?.code?.source
        : viewForModel("MINDMAP", outcome.content);
  console.log(
    typeof shown === "string"
      ? indent(shown)
      : indent(shown && "ok" in shown && shown.ok ? shown.material : ""),
  );
  console.log("");
}

console.log(
  `Razem: ${tokensIn} tokenów wejścia, ${tokensOut} wyjścia (z myśleniem).` +
    (failed > 0 ? ` Nie przeszło prób: ${failed}.` : ""),
);
process.exit(failed > 0 ? 1 : 0);
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}
