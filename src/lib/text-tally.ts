/*
  Ile w notatce słów i znaków.

  Liczymy TO, CO WIDAĆ na kartce, a nie zapis. Do tej pory pod edytorem stało
  `body.length` — czyli długość surowego markdownu, razem z gwiazdkami
  pogrubienia, znacznikami barwy (trzydzieści dziewięć znaków narzutu na jedno
  pokolorowane słowo), kwadracikami zadań, kreskami tabeli i całym zapisem
  zdjęcia. Liczba nie miała nic wspólnego z tym, co człowiek napisał.

  REGUŁY, ŻEBY TELEFON I STRONA POKAZYWAŁY TO SAMO. Aplikacja ma własny
  odpowiednik tego pliku i musi liczyć tak samo, więc reguły są tu wypisane,
  a nie tylko zaklęte w kodzie:

   - Słowo to kawałek między białymi znakami, w którym jest choć jedna litera
     albo cyfra. Sam myślnik, sama kropka i samo „—" słowem nie są.
   - Znaki liczymy razem ze spacjami, ale bez złamań wiersza: końca wiersza
     nikt na kartce nie widzi.
   - Liczymy PUNKTY KODOWE, nie jednostki UTF-16. Bez tego jedna emotikona
     liczyłaby się jako dwa znaki.
   - Akapit to grupa niepustych wierszy oddzielona pustym wierszem.
*/

import { markdownToPlain } from "@/lib/rich-text";

export type Tally = {
  words: number;
  /** Ze spacjami, bez złamań wiersza. */
  chars: number;
  charsNoSpaces: number;
  paragraphs: number;
};

/** Zawiera literę albo cyfrę - w dowolnym alfabecie, nie tylko łacińskim. */
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export function tally(markdown: string): Tally {
  const plain = markdownToPlain(markdown);

  const words = plain.split(/\s+/).filter((chunk) => HAS_LETTER_OR_DIGIT.test(chunk)).length;

  // Array.from idzie po punktach kodowych, więc „🙂" to jeden znak, a nie dwa.
  const chars = Array.from(plain.replace(/\n/g, "")).length;
  const charsNoSpaces = Array.from(plain.replace(/\s/gu, "")).length;

  const paragraphs = plain
    .split(/\n\s*\n/)
    .filter((block) => HAS_LETTER_OR_DIGIT.test(block)).length;

  return { words, chars, charsNoSpaces, paragraphs };
}
