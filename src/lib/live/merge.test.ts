import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyDelta,
  diff,
  isDelta,
  jsonEqual,
  merge3,
  mergeText,
  splitLines,
  wordTokens,
  type Delta,
  type Json,
} from "./merge";

/*
  Silnik zmian notatki. Przypadki z live-vectors.json sprawdza też aplikacja
  (LiveMergeTest.kt) - ta sama tabela po obu stronach pilnuje, żeby strona
  i tablet scalały notatkę tak samo.
*/

type Vectors = {
  merge: { name: string; base: Json; mine: Json; theirs: Json; merged: Json }[];
  diff: { name: string; base: Json; target: Json; delta: Delta | null }[];
};

const vectors: Vectors = JSON.parse(
  readFileSync(path.join(__dirname, "live-vectors.json"), "utf8"),
);

describe("wspólne przypadki scalania", () => {
  for (const vector of vectors.merge) {
    it(vector.name, () => {
      expect(merge3(vector.base, vector.mine, vector.theirs)).toEqual(vector.merged);
    });
  }
});

describe("wspólne przypadki różnicy", () => {
  for (const vector of vectors.diff) {
    it(vector.name, () => {
      const delta = diff(vector.base, vector.target);
      expect(delta ?? null).toEqual(vector.delta);
      if (delta) {
        expect(isDelta(delta)).toBe(true);
        expect(applyDelta(vector.base, delta)).toEqual(vector.target);
      }
    });
  }
});

/** Prosty, powtarzalny generator liczb - testy losowe mają się dać odtworzyć. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function randomDocument(next: () => number, counter: { value: number }): Json {
  const strokes: Json[] = [];
  const count = Math.floor(next() * 6);
  for (let i = 0; i < count; i += 1) {
    counter.value += 1;
    strokes.push({ id: `s${counter.value}`, color: Math.floor(next() * 5), points: [next(), next()] });
  }
  return {
    title: next() < 0.5 ? "Notatka" : "Inna",
    pages: [{ id: "p1", strokes }],
    text: { markdown: ["Ala", "ma", "kota", "i psa"].slice(0, 1 + Math.floor(next() * 4)).join("\n") },
  };
}

function mutate(document: Json, next: () => number, counter: { value: number }): Json {
  const copy = JSON.parse(JSON.stringify(document)) as {
    title: string;
    pages: { id: string; strokes: { id: string; color: number; points: number[] }[] }[];
    text: { markdown: string };
  };
  const strokes = copy.pages[0].strokes;
  const steps = 1 + Math.floor(next() * 4);
  for (let i = 0; i < steps; i += 1) {
    const roll = next();
    if (roll < 0.25) {
      counter.value += 1;
      strokes.splice(Math.floor(next() * (strokes.length + 1)), 0, {
        id: `s${counter.value}`,
        color: 1,
        points: [next()],
      });
    } else if (roll < 0.4 && strokes.length > 0) {
      strokes.splice(Math.floor(next() * strokes.length), 1);
    } else if (roll < 0.55 && strokes.length > 1) {
      const [moved] = strokes.splice(Math.floor(next() * strokes.length), 1);
      strokes.splice(Math.floor(next() * (strokes.length + 1)), 0, moved);
    } else if (roll < 0.7 && strokes.length > 0) {
      strokes[Math.floor(next() * strokes.length)].color = Math.floor(next() * 9);
    } else if (roll < 0.9) {
      const lines = copy.text.markdown.split("\n");
      lines.splice(Math.floor(next() * (lines.length + 1)), 0, `wiersz ${counter.value}`);
      copy.text.markdown = lines.join("\n");
    } else {
      copy.title = `Tytuł ${Math.floor(next() * 3)}`;
    }
  }
  return copy as unknown as Json;
}

describe("różnica i nałożenie - losowo", () => {
  it("nałożona różnica zawsze odtwarza cel", () => {
    const next = random(7);
    const counter = { value: 0 };
    for (let round = 0; round < 400; round += 1) {
      const base = randomDocument(next, counter);
      const target = mutate(base, next, counter);
      const delta = diff(base, target);
      const rebuilt = delta ? applyDelta(base, delta) : base;
      expect(jsonEqual(rebuilt, target)).toBe(true);
      // Delta przechodzi przez JSON w obie strony bez zmian.
      if (delta) expect(isDelta(JSON.parse(JSON.stringify(delta)))).toBe(true);
    }
  });

  it("scalanie z niezmienioną stroną oddaje drugą stronę", () => {
    const next = random(11);
    const counter = { value: 1000 };
    for (let round = 0; round < 200; round += 1) {
      const base = randomDocument(next, counter);
      const changed = mutate(base, next, counter);
      expect(merge3(base, changed, base)).toEqual(changed);
      expect(merge3(base, base, changed)).toEqual(changed);
    }
  });

  it("niezależne kreski z obu stron trafiają do wyniku", () => {
    const next = random(23);
    const counter = { value: 5000 };
    for (let round = 0; round < 200; round += 1) {
      const base = randomDocument(next, counter) as { pages: { strokes: { id: string }[] }[] };
      const mine = JSON.parse(JSON.stringify(base));
      const theirs = JSON.parse(JSON.stringify(base));
      counter.value += 1;
      mine.pages[0].strokes.push({ id: `m${counter.value}` });
      theirs.pages[0].strokes.push({ id: `t${counter.value}` });
      const merged = merge3(base as unknown as Json, mine, theirs) as typeof base;
      const ids = merged.pages[0].strokes.map((stroke) => stroke.id);
      expect(ids).toContain(`m${counter.value}`);
      expect(ids).toContain(`t${counter.value}`);
      expect(ids.length).toBe(base.pages[0].strokes.length + 2);
    }
  });
});

describe("scalanie tekstu", () => {
  it("dzieli na wiersze bez gubienia znaków", () => {
    expect(splitLines("a\nb\n\nc")).toEqual(["a\n", "b\n", "\n", "c"]);
    expect(splitLines("")).toEqual([]);
  });

  it("dzieli na słowa, odstępy i znaki", () => {
    expect(wordTokens("Zażółć  gęślą, jaźń!\n")).toEqual([
      "Zażółć",
      "  ",
      "gęślą",
      ",",
      " ",
      "jaźń",
      "!",
      "\n",
    ]);
  });

  it("zmiana tylko po jednej stronie przechodzi bez sporu", () => {
    expect(mergeText("a\nb\n", "a\nb\nc\n", "a\nb\n")).toBe("a\nb\nc\n");
  });

  it("skasowany wiersz i poprawka w innym wierszu", () => {
    expect(mergeText("a\nb\nc\n", "a\nc\n", "a\nb\nc!\n")).toBe("a\nc!\n");
  });

  it("dwa razy to samo dopisane daje jeden dopisek", () => {
    expect(mergeText("a\n", "a\nb\n", "a\nb\n")).toBe("a\nb\n");
  });

  it("pisanie w tym samym zdaniu, w różnych słowach", () => {
    expect(
      mergeText(
        "Spotkanie w poniedziałek o 10.\n",
        "Spotkanie zespołu w poniedziałek o 10.\n",
        "Spotkanie w poniedziałek o 11.\n",
      ),
    ).toBe("Spotkanie zespołu w poniedziałek o 11.\n");
  });

  it("bardzo długi tekst nie zawiesza scalania", () => {
    const base = Array.from({ length: 4000 }, (_, i) => `wiersz ${i}`).join("\n");
    const mine = base.replace("wiersz 10\n", "wiersz dziesiąty\n");
    const theirs = base.replace("wiersz 3990\n", "wiersz prawie ostatni\n");
    const started = Date.now();
    const merged = mergeText(base, mine, theirs);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(merged).toContain("wiersz dziesiąty\n");
    expect(merged).toContain("wiersz prawie ostatni\n");
  });
});

describe("delta z zewnątrz", () => {
  it("odrzuca podejrzane kształty", () => {
    expect(isDelta({ o: { __proto__: { $: 1 } } })).toBe(true); // literał nie tworzy pola
    expect(isDelta(JSON.parse('{"o":{"__proto__":{"$":1}}}'))).toBe(false);
    expect(isDelta({ x: 1 })).toBe(false);
    expect(isDelta({ t: [[-1, 0, "a"]] })).toBe(false);
    expect(isDelta({ k: { p: [[null, "a", { id: "b" }]] } })).toBe(false);
    expect(isDelta({ $: 1, o: {} })).toBe(false);
  });

  it("nie dotyka prototypu obiektów", () => {
    const result = applyDelta({}, JSON.parse('{"o":{"__proto__":{"o":{"polluted":{"$":1}}}}}'));
    expect(({} as { polluted?: number }).polluted).toBeUndefined();
    expect(Object.keys(result as object)).toEqual([]);
  });

  it("wymiana tekstu poza zakresem nie wywraca nałożenia", () => {
    expect(applyDelta("abc", { t: [[10, 5, "x"]] })).toBe("abcx");
  });

  it("przesunięcie nieistniejącego elementu nic nie psuje", () => {
    expect(applyDelta([{ id: "a" }], { k: { p: [["a", "zz"]] } })).toEqual([{ id: "a" }]);
  });
});
