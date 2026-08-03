import nodemailer from "nodemailer";
import { settings, mailWorks } from "./settings";

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
  footer?: string;
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
  if (message.button) parts.push("", `${message.button.label}: ${message.button.url}`);
  if (message.footer) parts.push("", message.footer);
  return parts.join("\n");
}

function asHtml(message: Message): string {
  const paragraphs = message.body
    .map((paragraph) => `<p style="margin:0 0 14px 0;">${escapeHtml(paragraph)}</p>`)
    .join("");

  const button = message.button
    ? `<p style="margin:26px 0 0 0;">
         <a href="${escapeHtml(message.button.url)}"
            style="display:inline-block;background:#0F6B5C;color:#F4F1EA;text-decoration:none;
                   padding:13px 22px;border-radius:3px;font-weight:600;">
           ${escapeHtml(message.button.label)}
         </a>
       </p>
       <p style="margin:16px 0 0 0;color:#67635A;font-size:13px;">
         Gdyby przycisk nie działał, otwórz ten adres:<br>
         <span style="word-break:break-all;">${escapeHtml(message.button.url)}</span>
       </p>`
    : "";

  const footer = message.footer
    ? `<p style="margin:26px 0 0 0;padding-top:16px;border-top:1px solid #D3CCBC;
                 color:#67635A;font-size:13px;">${escapeHtml(message.footer)}</p>`
    : "";

  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"></head>
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

export function confirmationMail(address: string, link: string): Message {
  return {
    to: address,
    subject: "Potwierdź adres w Kajecie",
    heading: "Potwierdź swój adres",
    body: [
      "Ktoś założył konto w Kajecie na ten adres. Jeśli to Ty, potwierdź go przyciskiem poniżej.",
      "Odnośnik jest ważny przez dobę.",
    ],
    button: { label: "Potwierdzam adres", url: link },
    footer: "Jeśli to nie Ty zakładałeś konto, po prostu nie klikaj. Nic się nie stanie.",
  };
}

export function passwordResetMail(address: string, link: string): Message {
  return {
    to: address,
    subject: "Nowe hasło do Kajetu",
    heading: "Ustaw nowe hasło",
    body: [
      "Dostaliśmy prośbę o zmianę hasła do Twojego konta.",
      "Odnośnik jest ważny przez godzinę i działa jeden raz.",
    ],
    button: { label: "Ustawiam nowe hasło", url: link },
    footer: "Jeśli nie prosiłeś o zmianę hasła, zignoruj tę wiadomość. Hasło zostaje bez zmian.",
  };
}

export function inviteMail(address: string, link: string, fromWhom: string): Message {
  return {
    to: address,
    subject: "Zaproszenie do Kajetu",
    heading: "Masz zaproszenie do Kajetu",
    body: [
      `${fromWhom} zaprasza Cię do Kajetu, czyli do notatnika z notatkami odręcznymi, tekstowymi i mapami myśli.`,
      "Kod zaproszenia jest już wpisany w odnośniku. Wystarczy podać adres i hasło.",
    ],
    button: { label: "Zakładam konto", url: link },
  };
}

export function shareMail(
  address: string,
  link: string,
  fromWhom: string,
  title: string,
  forEditing: boolean,
): Message {
  return {
    to: address,
    subject: `${fromWhom} udostępnia Ci notatkę: ${title}`,
    heading: forEditing ? "Możesz wspólnie pisać tę notatkę" : "Udostępniono Ci notatkę",
    body: [
      `${fromWhom} udostępnia Ci notatkę „${title}”.`,
      forEditing
        ? "Masz prawo do zmian. Jeśli będziecie pisać jednocześnie, zmiany drugiej osoby zobaczysz na bieżąco."
        : "Możesz ją czytać. Zmian nie zapiszesz.",
    ],
    button: { label: "Otwieram notatkę", url: link },
  };
}
