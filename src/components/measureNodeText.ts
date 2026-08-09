"use client";

import type { MindNode } from "@/lib/document";
import { cssFont } from "@/lib/document";

/*
  Zmierzenie hasła w węźle mapy - naprawdę, a nie na oko.

  Serwer musi rozmiar węzła OSZACOWAĆ (mindmap-layout.ts), bo nie ma tam miar
  pisma. W przeglądarce nie ma po co zgadywać: ten sam napis, w tym samym
  kroju, w tym samym rozmiarze można po prostu wstawić do niewidocznego pudełka
  i odczytać, ile zajął. Stąd bierze się wysokość węzła, w którym hasło się
  mieści zamiast zostać ucięte.

  Pudełko jest jedno na całą stronę i zostaje w drzewie - zakładanie go przy
  każdym naciśnięciu klawisza kosztowałoby więcej niż samo mierzenie.
*/

/** `padding: 6px 10px` z węzła, obustronnie. */
const PAD_X = 20;
const PAD_Y = 12;
/** Powyżej tej szerokości hasło schodzi do kolejnego wiersza zamiast rozpychać węzeł. */
const MAX_WIDTH = 280;
const MIN_WIDTH = 160;
const MIN_HEIGHT = 64;

let box: HTMLDivElement | null = null;

function measuringBox(): HTMLDivElement {
  if (box && box.isConnected) return box;
  box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  Object.assign(box.style, {
    position: "absolute",
    left: "-10000px",
    top: "0",
    visibility: "hidden",
    pointerEvents: "none",
    // Bez wyściółki: `scrollWidth` i `scrollHeight` wliczyłyby ją do wyniku,
    // a doliczamy ją niżej sami. Mierzymy samo pismo.
    padding: "0",
    border: "0",
    boxSizing: "content-box",
    lineHeight: "1.3",
    wordBreak: "break-word",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.append(box);
  return box;
}

/**
 * Rozmiar, w którym hasło węzła się zmieści.
 *
 * Węzeł tylko ROŚNIE. Skurczenie go po skasowaniu połowy hasła byłoby
 * zaskoczeniem: człowiek, który rozciągnął pudełko ręcznie, zastałby je za
 * chwilę mniejsze, bo poprawił literówkę. Zmniejsza się uchwytem w rogu,
 * czyli wtedy, gdy ktoś tego chce.
 */
export function grownNodeSize(node: MindNode): { width: number; height: number } {
  const width = node.width ?? MIN_WIDTH;
  const height = node.height ?? MIN_HEIGHT;
  const text = node.text ?? "";
  if (typeof document === "undefined" || !text.trim()) return { width, height };

  const shell = measuringBox();
  shell.style.fontFamily = cssFont(node.font);
  shell.style.fontSize = `${node.fontSize ?? 15}px`;
  shell.style.fontWeight = node.bold ? "600" : "400";
  shell.style.fontStyle = node.italic ? "italic" : "normal";
  shell.textContent = text;

  // Najpierw bez łamania: ile miejsca chciałby najdłuższy wiersz.
  shell.style.whiteSpace = "pre";
  shell.style.width = "auto";
  const wanted = Math.ceil(shell.scrollWidth) + PAD_X;

  const grownWidth = Math.max(width, Math.min(MAX_WIDTH, wanted));

  // Potem z łamaniem, już na docelowym wnętrzu: ile wierszy z tego wyszło.
  shell.style.whiteSpace = "pre-wrap";
  shell.style.width = `${Math.max(1, grownWidth - PAD_X)}px`;
  const grownHeight = Math.max(height, Math.ceil(shell.scrollHeight) + PAD_Y);

  return { width: grownWidth, height: grownHeight };
}

/** Zmiana rozmiaru albo null, gdy węzeł i tak jest wystarczająco duży. */
export function nodeGrowth(node: MindNode): { width: number; height: number } | null {
  const grown = grownNodeSize(node);
  if (grown.width === (node.width ?? MIN_WIDTH) && grown.height === (node.height ?? MIN_HEIGHT)) {
    return null;
  }
  return grown;
}
