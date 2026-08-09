"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { currentUser, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { issueToken } from "@/lib/app-token";
import { removeAccount } from "@/lib/account-delete";
import { accountDeletionMail, send } from "@/lib/mail";
import {
  CODE_MINUTES,
  clearDeletionTries,
  deletionTryAllowed,
  forgetDeletionCode,
  formatCode,
  issueDeletionCode,
  noteFailedDeletionTry,
  useDeletionCode,
} from "@/lib/deletion-code";
import { writingColumns, writingSettingsFromForm } from "@/lib/writing-settings";
import { currentWords } from "@/lib/language";
import { aiVisibleFor } from "@/lib/ai/access";
import { setAiConsent } from "@/lib/ai/consent";
import { tokensRevokedMsg, type Words } from "@/lib/i18n";

export type Result = {
  error?: string;
  success?: string;
  copyable?: { value: string; label?: string };
};

export async function logOut(): Promise<void> {
  await signOut({ redirectTo: "/signin" });
}

/**
 * Zamyka konto na wszystkich urządzeniach naraz.
 *
 * Sesje strony to podpisane ciasteczka, których nie da się skasować w bazie,
 * więc zostawiamy przy koncie znacznik czasu - `authConfig.jwt` odrzuca każde
 * ciasteczko wydane wcześniej. Tokeny aplikacji mobilnej leżą w bazie i po
 * prostu znikają.
 */
async function revokeEverywhere(userId: string): Promise<number> {
  const removed = await prisma.appToken.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { sessionsRevokedAt: new Date() },
  });
  return removed.count;
}

export async function logOutEverywhere(): Promise<void> {
  const user = await currentUser();
  if (!user) {
    await signOut({ redirectTo: "/signin" });
    return;
  }

  await revokeEverywhere(user.id);
  await signOut({ redirectTo: "/signin?wylogowano=wszedzie" });
}

export async function issueAppToken(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const device = String(data.get("device") ?? "").trim() || (await currentWords()).deviceFallback;
  const { token } = await issueToken(user.id, device);

  revalidatePath("/account");
  return {
    success:
      `Token dla urządzenia „${device}". Skopiuj go do aplikacji teraz, ` +
      `bo drugi raz go nie pokażemy:`,
    copyable: { value: token, label: "Kopiuj token" },
  };
}

export async function revokeDevice(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const id = String(data.get("id") ?? "");
  const removed = await prisma.appToken.deleteMany({
    where: { id, userId: user.id },
  });

  revalidatePath("/account");
  return removed.count > 0
    ? { success: (await currentWords()).actTokenRevoked }
    : { error: (await currentWords()).actNoSuchToken };
}

/*
  Własna nazwa urządzenia.

  Aplikacja zgłasza się modelem sprzętu („TB520FU"), a przy dwóch tabletach tej
  samej marki nie da się z tego poznać, który jest który - i nie wiadomo, który
  token unieważnić. Tutaj można nazwać je po ludzku: „tablet w szkole",
  „telefon Ani".
*/
export async function renameDevice(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const id = String(data.get("id") ?? "");
  const name = String(data.get("device") ?? "").trim().slice(0, 120);
  if (!name) return { error: (await currentWords()).actGiveDeviceName };

  const renamed = await prisma.appToken.updateMany({
    where: { id, userId: user.id },
    data: { device: name },
  });

  revalidatePath("/account");
  return renamed.count > 0
    ? { success: `Urządzenie nazywa się teraz „${name}".` }
    : { error: (await currentWords()).actNoSuchToken };
}

export async function revokeAllDevices(_previous: Result, _data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const removed = await prisma.appToken.deleteMany({ where: { userId: user.id } });
  revalidatePath("/account");
  return removed.count > 0
    ? {
        success: tokensRevokedMsg(await currentWords(), removed.count),
      }
    : { error: (await currentWords()).actNoTokensToRevoke };
}

/**
 * Ustawienia pisania: autozapis, grube pismo i wygląd nowej notatki tekstowej.
 *
 * Zapis idzie prosto do konta, więc obowiązuje w każdej przeglądarce - inaczej
 * niż gdyby siedział w pamięci jednej z nich. Otwarte notatki dostają nowe
 * ustawienia przy najbliższym wejściu na stronę notatki.
 */
export async function saveWritingSettings(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const settings = writingSettingsFromForm(data);
  await prisma.user.update({ where: { id: user.id }, data: writingColumns(settings) });

  revalidatePath("/account");
  return {
    success: settings.autoSave
      ? (await currentWords()).actSavedAutosaveOn
      : (await currentWords()).actSavedAutosaveOff,
  };
}

function passwordForm(words: Words) {
  return z.object({
    current: z.string(),
    next: z.string().min(8, words.actPasswordTooShort),
    repeat: z.string(),
  });
}

export async function changePassword(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const parsed = passwordForm(await currentWords()).safeParse({
    current: data.get("current") ?? "",
    next: data.get("next"),
    repeat: data.get("repeat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await currentWords()).actCheckWhatYouTyped };
  }

  const { current, next, repeat } = parsed.data;
  if (next !== repeat) return { error: (await currentWords()).actPasswordsDiffer };

  // An account with a password must give the old one. An account created
  // through Google has no password and is setting one now, so there is
  // nothing to check.
  if (user.passwordHash) {
    if (!current) return { error: (await currentWords()).actGiveCurrentPassword };
    if (!(await bcrypt.compare(current, user.passwordHash))) {
      return { error: (await currentWords()).actCurrentPasswordWrong };
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 12) },
  });

  /*
    Zmiana hasła zamyka konto wszędzie - także w tej przeglądarce. Inaczej
    zmiana hasła po tym, jak ktoś obcy dostał się na konto, nic by nie dała:
    jego sesja i token aplikacji chodziłyby dalej.
  */
  await revokeEverywhere(user.id);
  revalidatePath("/account");
  await signOut({
    redirectTo: user.passwordHash
      ? "/signin?wylogowano=haslo"
      : "/signin?wylogowano=haslo-nowe",
  });
  return {};
}

/*
  Skasowanie własnego konta - dwa kroki.

  Krok pierwszy wysyła kod na adres konta, krok drugi ten kod przyjmuje i od
  razu kasuje wszystko. Dwa kroki, bo skasowania nie da się cofnąć, a samo
  kliknięcie w panelu byłoby na łasce każdego, kto usiądzie przy cudzej
  otwartej przeglądarce. Skrzynka pocztowa jest tu drugim kluczem.
*/

export async function sendDeletionCode(_previous: Result, _data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const code = await issueDeletionCode(user.email);
  const sent = await send(accountDeletionMail(user.email, formatCode(code), CODE_MINUTES));

  // Kod bez wiadomości jest bezużyteczny, a zostawiony w bazie tylko czeka na
  // zgadnięcie. Skoro poczta nie poszła, niech nie zostaje po nim ślad.
  if (!sent) {
    await forgetDeletionCode(user.email);
    return { error: (await currentWords()).deletionMailFailed };
  }

  return { success: (await currentWords()).deletionCodeSent };
}

export async function deleteOwnAccount(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const typed = String(data.get("code") ?? "").trim();
  if (!typed) return { error: (await currentWords()).deletionGiveCode };

  // Kod ma osiem znaków, więc bez zapory dałoby się go zgadywać w nieskończoność.
  const gate = deletionTryAllowed(user.id);
  if (!gate.allowed) return { error: (await currentWords()).deletionTooManyTries };

  const check = await useDeletionCode(user.email, typed);
  if (!check.ok) {
    noteFailedDeletionTry(user.id);
    return {
      error:
        check.reason === "expired"
          ? (await currentWords()).deletionCodeExpired
          : (await currentWords()).deletionCodeWrong,
    };
  }

  clearDeletionTries(user.id);

  const removed = await removeAccount(user.id);
  if (!removed) return { error: (await currentWords()).apiMustSignIn };

  // Ślad, że konto zniknęło z woli właściciela, a nie ręką administratora.
  // Bez adresu e-mail i bez identyfikatora - konta już nie ma.
  await prisma.auditEntry.create({
    data: {
      actorId: null,
      action: "account.self.deleted",
      details: `${removed.login}, notatek: ${removed.noteCount}`,
    },
  });

  await signOut({ redirectTo: "/signin?wylogowano=konto-skasowane" });
  return {};
}

export async function changeOwnLogin(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: (await currentWords()).apiMustSignIn };

  const login = String(data.get("login") ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,24}$/.test(login)) {
    return {
      error:
        (await currentWords()).actLoginRules,
    };
  }

  const taken = await prisma.user.findUnique({ where: { login }, select: { id: true } });
  if (taken && taken.id !== user.id) return { error: (await currentWords()).actLoginTaken };

  await prisma.user.update({ where: { id: user.id }, data: { login } });
  revalidatePath("/account");
  return { success: `Login zmieniony na ${login}.` };
}

/**
 * Zgoda na wysyłanie treści notatek do Google - udzielenie i wycofanie.
 *
 * Ta sama droga, co punkt dla aplikacji: zgoda siedzi przy koncie, a jej
 * wycofanie kasuje przy okazji rozmowy z asystentem.
 */
export async function changeAiConsent(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  const words = await currentWords();
  if (!user) return { error: words.apiNotSignedIn };
  // Konto bez uprawnienia nie ma się na co zgadzać - i nie ma się dowiedzieć,
  // że jest czego odmawiać.
  if (!aiVisibleFor(user)) return { error: words.apiUnknownAddress };

  const consented = String(data.get("consented") ?? "") === "1";
  await setAiConsent(user.id, consented);

  revalidatePath("/account");
  return { success: consented ? words.aiConsentGiven : words.aiConsentWithdrawn };
}
