"use client";

import { useEffect } from "react";
import { Icon } from "@/components/Icon";
import { useWords } from "@/components/LanguageProvider";

/*
  Okno drukowania na stronie do druku. Czeka na pisma i zdjęcia - wołane od
  razu drukowało kartkę z pustymi ramkami w miejscu obrazków i rysunków.
  Przyciski zostają na ekranie (gdyby ktoś zamknął okno i chciał jeszcze raz),
  ale na papier nie wychodzą (klasa no-print).
*/
export function AutoPrint() {
  const words = useWords();

  useEffect(() => {
    let cancelled = false;
    const images = Array.from(document.images).filter((image) => !image.complete);
    const svgImages = Array.from(document.querySelectorAll("svg image"));
    const loaded = (element: Element) =>
      new Promise<void>((resolve) => {
        element.addEventListener("load", () => resolve(), { once: true });
        element.addEventListener("error", () => resolve(), { once: true });
      });
    // Obrazek w SVG nie ma pola `complete` - dajemy mu chwilę, nie wieczność.
    const pending = [...images, ...svgImages].map(loaded);
    const patience = new Promise<void>((resolve) => setTimeout(resolve, 2500));
    void Promise.race([
      Promise.all([document.fonts.ready, ...pending]).then(() => undefined),
      patience,
    ]).then(() => {
      if (!cancelled) window.print();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="row no-print" style={{ marginBottom: 18 }}>
      <button type="button" className="button compact primary" onClick={() => window.print()}>
        <Icon name="print" size={18} />
        {words.printNote}
      </button>
      <button type="button" className="button compact" onClick={() => window.close()}>
        {words.printClose}
      </button>
    </div>
  );
}
