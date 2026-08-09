import { describe, expect, it } from "vitest";
import { fingerprintOf, LONGEST_FINGERPRINT } from "./crash-report";

const REPORT = [
  "Kajet 1.0",
  "Czas: 2026-08-06 14:33:14",
  "Urządzenie: LENOVO TB520FU, Android 16",
  "Wątek: main",
  "",
  "java.lang.IllegalStateException: coś pękło",
  "\tat wojtoteka.ovh.kajet.Cos.metoda(Cos.kt:42)",
  "\tat wojtoteka.ovh.kajet.Inne.dalej(Inne.kt:7)",
].join("\n");

describe("fingerprintOf", () => {
  it("bierze rodzaj wyjątku i szczyt stosu, pomija nagłówek", () => {
    const odcisk = fingerprintOf(REPORT);

    expect(odcisk).toContain("IllegalStateException: coś pękło");
    expect(odcisk).toContain("Cos.kt:42");
    // Nagłówek opisuje urządzenie, nie usterkę - dwa tablety z tą samą
    // awarią mają dać ten sam odcisk.
    expect(odcisk).not.toContain("TB520FU");
    expect(odcisk).not.toContain("Czas:");
  });

  it("ta sama awaria z dwóch urządzeń ma jeden odcisk", () => {
    const zInnego = REPORT.replace("LENOVO TB520FU, Android 16", "samsung SM-X710, Android 14")
      .replace("14:33:14", "09:01:55");

    expect(fingerprintOf(zInnego)).toBe(fingerprintOf(REPORT));
  });

  it("ten sam wyjątek w innym miejscu to inny odcisk", () => {
    const gdzieIndziej = REPORT.replace("Cos.kt:42", "Zupelnie.kt:9").replace(
      "Cos.metoda",
      "Zupelnie.inaczej",
    );

    expect(fingerprintOf(gdzieIndziej)).not.toBe(fingerprintOf(REPORT));
  });

  it("radzi sobie z raportem bez nagłówka i bez stosu", () => {
    expect(fingerprintOf("java.lang.OutOfMemoryError")).toBe("java.lang.OutOfMemoryError");
    expect(fingerprintOf("")).toBe("awaria bez opisu");
    expect(fingerprintOf("   \n  \n")).toBe("awaria bez opisu");
  });

  it("nie rozsadza kolumny w bazie", () => {
    const dlugi = ["", `java.lang.Exception: ${"x".repeat(5_000)}`, "\tat A.b(A.kt:1)"].join("\n");

    expect(fingerprintOf(dlugi).length).toBe(LONGEST_FINGERPRINT);
  });
});
