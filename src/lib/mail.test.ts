import { describe, expect, it } from "vitest";
import {
  accountDeletionMail,
  confirmationMail,
  inactiveAccountMail,
  inviteMail,
  passwordResetMail,
  shareMail,
  type Message,
} from "./mail";

const LINK = "https://kajet.example/x?token=abc";

function builders(language?: "pl" | "en"): Message[] {
  return [
    confirmationMail("a@b.pl", LINK, language),
    passwordResetMail("a@b.pl", LINK, language),
    accountDeletionMail("a@b.pl", "ABCD-EFGH", 60, language),
    inactiveAccountMail("a@b.pl", LINK, 365, 30, language),
    inviteMail("a@b.pl", LINK, "Ala", language),
    shareMail("a@b.pl", LINK, "Ala", "Notatka", true, "note", language),
    shareMail("a@b.pl", LINK, "Ala", "Folder", false, "folder", language),
  ];
}

describe("wiadomości e-mail", () => {
  it("bez wyboru język wiadomości jest polski", () => {
    for (const message of builders()) {
      expect(message.language).toBe("pl");
    }
  });

  it("każda wiadomość istnieje po polsku i po angielsku z tymi samymi odnośnikami", () => {
    const pl = builders("pl");
    const en = builders("en");

    expect(en).toHaveLength(pl.length);
    pl.forEach((polish, index) => {
      const english = en[index];
      expect(english.language).toBe("en");
      expect(english.subject).not.toBe(polish.subject);
      expect(english.heading).not.toBe(polish.heading);
      expect(english.body.length).toBe(polish.body.length);
      expect(english.button?.url).toBe(polish.button?.url);
      expect(english.code).toBe(polish.code);
      for (const text of [english.subject, english.heading, ...english.body]) {
        expect(text, "w angielskiej wiadomości nie ma polskich liter").not.toMatch(/[ąćęłńóśźż]/i);
      }
    });
  });

  it("nazwa udostępniającego i tytuł trafiają do obu wersji", () => {
    for (const language of ["pl", "en"] as const) {
      const message = shareMail("a@b.pl", LINK, "Ala", "Chemia", false, "note", language);
      expect(message.subject).toContain("Ala");
      expect(message.subject).toContain("Chemia");
    }
  });
});
