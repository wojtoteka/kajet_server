import nodemailer from "nodemailer";
import { settings, mailWorks } from "./settings";
import { DEFAULT_LANGUAGE, type Language } from "./i18n";

const globals = globalThis as unknown as {
  kajetMailTransport?: nodemailer.Transporter;
};

function transport(): nodemailer.Transporter | null {
  if (!mailWorks()) return null;
  if (globals.kajetMailTransport) return globals.kajetMailTransport;

  const created = nodemailer.createTransport({
    host: settings.mail.host,
    port: settings.mail.port,
    secure: settings.mail.secure,
    auth: settings.mail.user
      ? { user: settings.mail.user, pass: settings.mail.password }
      : undefined,
    // Port 587 requires STARTTLS. Without this some servers would accept a
    // cleartext connection and the password would travel in the open.
    requireTLS: !settings.mail.secure,
  });

  globals.kajetMailTransport = created;
  return created;
}

export type Message = {
  to: string;
  subject: string;
  heading: string;
  body: string[];
  button?: { label: string; url: string };
  /** Kod do przepisania ręcznie. Wyświetlany dużym pismem maszynowym. */
  code?: string;
  footer?: string;
  /** Język wiadomości - tylko do zdań, które dokłada sam szablon HTML. */
  language?: Language;
};

/** Zdania, które dokłada szablon HTML niezależnie od treści wiadomości. */
const FALLBACK_HINT: Record<Language, string> = {
  pl: "Gdyby przycisk nie działał, otwórz ten adres:",
  en: "If the button does not work, open this address:",
};

export async function send(message: Message): Promise<boolean> {
  const mailer = transport();
  if (!mailer) {
    console.warn(`[mail] Not sent to ${message.to}: no SMTP settings.`);
    return false;
  }

  try {
    await mailer.sendMail({
      from: settings.mail.from,
      to: message.to,
      subject: message.subject,
      text: asText(message),
      html: asHtml(message),
    });
    return true;
  } catch (problem) {
    console.error("[mail] Sending failed:", problem);
    return false;
  }
}

function asText(message: Message): string {
  const parts = [message.heading, "", ...message.body];
  if (message.code) parts.push("", message.code);
  if (message.button) parts.push("", `${message.button.label}: ${message.button.url}`);
  if (message.footer) parts.push("", message.footer);
  return parts.join("\n");
}

function asHtml(message: Message): string {
  const paragraphs = message.body
    .map((paragraph) => `<p style="margin:0 0 14px 0;">${escapeHtml(paragraph)}</p>`)
    .join("");

  // Kod do przepisania: duże pismo maszynowe i szerokie odstępy, żeby dało się
  // go odczytać z ekranu telefonu bez mrużenia oczu.
  const code = message.code
    ? `<p style="margin:24px 0 0 0;padding:16px 18px;background:#E7E2D6;border:1px solid #D3CCBC;
                 border-radius:3px;text-align:center;font-family:'Courier New',monospace;
                 font-size:26px;font-weight:700;letter-spacing:4px;color:#23211D;">
         ${escapeHtml(message.code)}
       </p>`
    : "";

  const button = message.button
    ? `<p style="margin:26px 0 0 0;">
         <a href="${escapeHtml(message.button.url)}"
            style="display:inline-block;background:#0F6B5C;color:#F4F1EA;text-decoration:none;
                   padding:13px 22px;border-radius:3px;font-weight:600;">
           ${escapeHtml(message.button.label)}
         </a>
       </p>
       <p style="margin:16px 0 0 0;color:#67635A;font-size:13px;">
         ${FALLBACK_HINT[message.language ?? DEFAULT_LANGUAGE]}<br>
         <span style="word-break:break-all;">${escapeHtml(message.button.url)}</span>
       </p>`
    : "";

  const footer = message.footer
    ? `<p style="margin:26px 0 0 0;padding-top:16px;border-top:1px solid #D3CCBC;
                 color:#67635A;font-size:13px;">${escapeHtml(message.footer)}</p>`
    : "";

  return `<!doctype html>
<html lang="${message.language ?? DEFAULT_LANGUAGE}"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#E7E2D6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E7E2D6;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#F4F1EA;border:1px solid #D3CCBC;border-radius:3px;">
        <tr><td style="padding:28px 30px;border-left:2px solid #0F6B5C;">
          <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:1.4px;
                    text-transform:uppercase;color:#67635A;font-weight:600;">Kajet</p>
          <h1 style="margin:0 0 18px 0;font-size:21px;line-height:1.3;color:#23211D;font-weight:600;">
            ${escapeHtml(message.heading)}
          </h1>
          <div style="font-size:15px;line-height:1.62;color:#23211D;">
            ${paragraphs}
            ${code}
            ${button}
            ${footer}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Ready-made messages ---
//
// Każda wiadomość istnieje po polsku i po angielsku. Język wybiera ten, kto
// wywołuje wiadomość (ciasteczko strony albo nagłówek Accept-Language z
// aplikacji); bez wyboru - na przykład przy nocnym sprzątaniu kont, gdzie nie
// ma żądania - zostaje polski.

export function confirmationMail(
  address: string,
  link: string,
  language: Language = DEFAULT_LANGUAGE,
): Message {
  if (language === "en") {
    return {
      to: address,
      language,
      subject: "Confirm your email address for Kajet",
      heading: "Confirm your email address",
      body: [
        "Someone created a Kajet account with this email address. If that was you, confirm it with the button below.",
        "The link is valid for 24 hours.",
      ],
      button: { label: "Confirm email address", url: link },
      footer: "If you did not create an account, just ignore this message. Nothing will happen.",
    };
  }
  return {
    to: address,
    language,
    subject: "Potwierdź adres w Kajecie",
    heading: "Potwierdź swój adres",
    body: [
      "Ktoś założył konto w Kajecie na ten adres. Jeśli to Ty, potwierdź go przyciskiem poniżej.",
      "Odnośnik jest ważny przez dobę.",
    ],
    button: { label: "Potwierdź adres", url: link },
    footer: "Jeśli to nie Ty zakładasz konto, po prostu zignoruj tę wiadomość. Nic się nie stanie.",
  };
}

export function passwordResetMail(
  address: string,
  link: string,
  language: Language = DEFAULT_LANGUAGE,
): Message {
  if (language === "en") {
    return {
      to: address,
      language,
      subject: "New password for Kajet",
      heading: "Set a new password",
      body: [
        "We received a request to change the password for your account.",
        "The link is valid for one hour and works once.",
      ],
      button: { label: "Set a new password", url: link },
      footer:
        "If you did not request a password change, ignore this message. Your password will stay the same.",
    };
  }
  return {
    to: address,
    language,
    subject: "Nowe hasło do Kajetu",
    heading: "Ustaw nowe hasło",
    body: [
      "Dostaliśmy prośbę o zmianę hasła do Twojego konta.",
      "Odnośnik jest ważny przez godzinę i działa jeden raz.",
    ],
    button: { label: "Ustaw nowe hasło", url: link },
    footer:
      "Jeśli to nie Ty prosisz o zmianę hasła, zignoruj tę wiadomość. Hasło zostanie bez zmian.",
  };
}

/**
 * Kod potwierdzający skasowanie konta.
 *
 * Bez odnośnika: kliknięcie w wiadomości nie może kasować konta, bo wystarczy
 * wtedy jeden nieuważny ruch albo program pocztowy, który sam odwiedza
 * odnośniki. Kod trzeba świadomie przepisać w otwartym panelu.
 */
export function accountDeletionMail(
  address: string,
  code: string,
  minutes: number,
  language: Language = DEFAULT_LANGUAGE,
): Message {
  if (language === "en") {
    return {
      to: address,
      language,
      subject: "Kajet account deletion code",
      heading: "Confirm account deletion",
      body: [
        "Someone asked to delete this Kajet account. If that was you, enter the code below on your account page.",
        `The code is valid for ${minutes} minutes and works once.`,
        "Once you enter it, the account is deleted immediately, together with all notes, " +
          "attachments and shared links. This cannot be undone.",
      ],
      code,
      footer:
        "If you did not request this, ignore this message and change your password – " +
        "someone may have gained access to your browser. The account will not be deleted " +
        "without this code.",
    };
  }
  return {
    to: address,
    language,
    subject: "Kod potwierdzający usunięcie konta w Kajecie",
    heading: "Potwierdź usunięcie konta",
    body: [
      "Ktoś poprosił o usunięcie tego konta w Kajecie. Jeśli to Ty, przepisz " +
        "poniższy kod na stronie konta.",
      `Kod jest ważny przez ${minutes} minut i działa jeden raz.`,
      "Po jego wpisaniu konto zniknie natychmiast, razem ze wszystkimi notatkami, " +
        "załącznikami i udostępnionymi odnośnikami. Tego nie da się cofnąć.",
    ],
    code,
    footer:
      "Jeśli to nie Ty prosisz o usunięcie konta, zignoruj tę wiadomość i zmień " +
      "hasło – ktoś mógł dostać się do Twojej przeglądarki. Bez tego kodu konto " +
      "nie zostanie usunięte.",
  };
}

/**
 * Ostrzeżenie przed skasowaniem nieużywanego konta.
 *
 * Wysyłane raz, po roku bez śladu życia na koncie. Wystarczy się zalogować -
 * najbliższe sprzątanie zobaczy świeży ślad i skasuje ostrzeżenie samo.
 */
export function inactiveAccountMail(
  address: string,
  link: string,
  days: number,
  graceDays: number,
  language: Language = DEFAULT_LANGUAGE,
): Message {
  if (language === "en") {
    return {
      to: address,
      language,
      subject: "Your Kajet account will be deleted",
      heading: "We have not seen you for a while",
      body: [
        `There has been no activity on your Kajet account for ${days} days.`,
        `If you do not sign in within ${graceDays} days, the account will be deleted ` +
          "together with all notes, attachments and shared links. This cannot be undone.",
        "To keep it, just sign in – on the website or in the app. Nothing else is needed.",
      ],
      button: { label: "Sign in", url: link },
      footer:
        "If you no longer need the account, just ignore this message. " +
        "We will delete it for you.",
    };
  }
  return {
    to: address,
    language,
    subject: "Twoje konto w Kajecie zostanie usunięte",
    heading: "Dawno Cię tu nie było",
    body: [
      `Na Twoim koncie w Kajecie nie było żadnej aktywności od ${days} dni.`,
      `Jeśli nie zalogujesz się w ciągu ${graceDays} dni, konto zostanie usunięte ` +
        "razem ze wszystkimi notatkami, załącznikami i udostępnionymi odnośnikami. " +
        "Tego się nie da cofnąć.",
      "Żeby je zachować, wystarczy się zalogować – na stronie albo w aplikacji. " +
        "Nic więcej nie trzeba robić.",
    ],
    button: { label: "Zaloguj się", url: link },
    footer:
      "Jeśli konto nie jest Ci już potrzebne, po prostu zignoruj tę wiadomość. " +
      "Usuniemy je automatycznie.",
  };
}

export function inviteMail(
  address: string,
  link: string,
  fromWhom: string,
  language: Language = DEFAULT_LANGUAGE,
): Message {
  if (language === "en") {
    return {
      to: address,
      language,
      subject: "Invitation to Kajet",
      heading: "You have been invited to Kajet",
      body: [
        `${fromWhom} has invited you to Kajet – a notebook for handwriting, text and mind maps.`,
        "The invite code is already in the link. All you need to do is enter your email address and a password.",
      ],
      button: { label: "Create an account", url: link },
    };
  }
  return {
    to: address,
    language,
    subject: "Zaproszenie do Kajetu",
    heading: "Masz zaproszenie do Kajetu",
    body: [
      `${fromWhom} zaprasza Cię do Kajetu – notatnika na pismo odręczne, tekst i mapy myśli.`,
      "Kod zaproszenia jest już wpisany w odnośniku. Wystarczy podać adres i hasło.",
    ],
    button: { label: "Załóż konto", url: link },
  };
}

export function shareMail(
  address: string,
  link: string,
  fromWhom: string,
  title: string,
  forEditing: boolean,
  /** Notatka albo cały folder - folder z podfolderami i wszystkim w środku. */
  what: "note" | "folder" = "note",
  language: Language = DEFAULT_LANGUAGE,
): Message {
  const folder = what === "folder";
  if (language === "en") {
    return {
      to: address,
      language,
      subject: folder
        ? `${fromWhom} shared a folder with you: ${title}`
        : `${fromWhom} shared a note with you: ${title}`,
      heading: forEditing
        ? folder
          ? "You can work on this folder together"
          : "You can edit this note together"
        : folder
          ? "A folder has been shared with you"
          : "A note has been shared with you",
      body: [
        folder
          ? `${fromWhom} has shared the folder “${title}” with you, along with everything in it.`
          : `${fromWhom} has shared the note “${title}” with you.`,
        forEditing
          ? "You have permission to make changes. If you edit at the same time, you will see the other person’s changes as they happen."
          : "You can read it, but you cannot save changes.",
        "Once you open the link (signed in with this address), the share is added to your library – on the website and in the Kajet app, marked “shared”. If you have the Kajet app, the link opens straight in it.",
      ],
      button: { label: folder ? "Open folder" : "Open note", url: link },
    };
  }
  return {
    to: address,
    language,
    subject: folder
      ? `${fromWhom} udostępnia Ci folder: ${title}`
      : `${fromWhom} udostępnia Ci notatkę: ${title}`,
    heading: forEditing
      ? folder
        ? "Możecie wspólnie pracować w tym folderze"
        : "Możesz wspólnie pisać tę notatkę"
      : folder
        ? "Udostępniono Ci folder"
        : "Udostępniono Ci notatkę",
    body: [
      folder
        ? `${fromWhom} udostępnia Ci folder „${title}” razem ze wszystkim, co w nim jest.`
        : `${fromWhom} udostępnia Ci notatkę „${title}”.`,
      forEditing
        ? "Masz prawo do zmian. Jeśli będziecie pisać jednocześnie, zmiany drugiej osoby zobaczysz na bieżąco."
        : "Możesz czytać, ale nie zapiszesz zmian.",
      "Po otwarciu odnośnika (zalogowany tym adresem) udostępnienie trafi do Twojej biblioteki – na stronie i w aplikacji Kajet, z oznaczeniem „udostępnione”. Jeśli masz aplikację Kajet, odnośnik otworzy się od razu w niej.",
    ],
    button: { label: folder ? "Otwórz folder" : "Otwórz notatkę", url: link },
  };
}
