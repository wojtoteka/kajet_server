import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_WRITING,
  readWritingSettings,
  writingColumns,
  writingSettingsFromForm,
} from "./writing-settings";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));

describe("readWritingSettings", () => {
  it("bez konta oddaje domyślne", () => {
    expect(readWritingSettings(null)).toEqual(DEFAULT_WRITING);
  });

  it("czyta ustawienia z wiersza konta", () => {
    expect(
      readWritingSettings({
        autoSave: false,
        textFont: "mono",
        textSize: 22,
        textAlign: "center",
        textBold: true,
      }),
    ).toEqual({ autoSave: false, font: "mono", fontSize: 22, align: "center", bold: true });
  });

  it("nieznany krój i wyrównanie lecą na domyślne", () => {
    const settings = readWritingSettings({ textFont: "comic", textAlign: "justify" });
    expect(settings.font).toBe("body");
    expect(settings.align).toBe("left");
  });

  it("rozmiar trzyma się przedziału, a zero znaczy domyślny", () => {
    expect(readWritingSettings({ textSize: 0 }).fontSize).toBe(0);
    expect(readWritingSettings({ textSize: 3 }).fontSize).toBe(10);
    expect(readWritingSettings({ textSize: 900 }).fontSize).toBe(48);
  });
});

describe("writingSettingsFromForm", () => {
  function form(entries: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.set(key, value);
    return data;
  }

  it("brak pola wyboru znaczy wyłączone", () => {
    // Niezaznaczony `checkbox` w ogóle nie trafia do formularza - dlatego
    // czytamy obecność pola, a nie jego wartość.
    const settings = writingSettingsFromForm(form({ font: "heading", fontSize: "20", align: "right" }));
    expect(settings).toEqual({
      autoSave: false,
      font: "heading",
      fontSize: 20,
      align: "right",
      bold: false,
    });
  });

  it("zaznaczone pola wyboru włączają ustawienie", () => {
    const settings = writingSettingsFromForm(form({ autoSave: "on", bold: "on" }));
    expect(settings.autoSave).toBe(true);
    expect(settings.bold).toBe(true);
  });

  it("wraca do kolumn konta bez zmiany treści", () => {
    const settings = writingSettingsFromForm(form({ autoSave: "on", font: "mono", fontSize: "17" }));
    expect(writingColumns(settings)).toEqual({
      autoSave: true,
      textFont: "mono",
      textSize: 17,
      textAlign: "left",
      textBold: false,
    });
  });
});
