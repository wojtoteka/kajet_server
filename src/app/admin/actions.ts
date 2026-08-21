"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { currentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recomputeUsed } from "@/lib/quota";
import { confirmationMail, inviteMail, passwordResetMail, send } from "@/lib/mail";
import { settings } from "@/lib/settings";
import { forgetFile, releasePath, sweepUnused, uploadedFile } from "@/lib/app-release";
import { apkVersion } from "@/lib/apk";
import { removeAccount } from "@/lib/account-delete";
import { currentWords } from "@/lib/language";
import type { Words } from "@/lib/i18n";
import {
  accountBlockedMsg,
  accountDeletedMsg,
  accountEmailNowMsg,
  accountLoginNowMsg,
  accountUnblockedMsg,
  adminRightsGivenMsg,
  adminRightsTakenMsg,
  aiAccessGivenMsg,
  aiAccessTakenMsg,
  aiLimitDefaultMsg,
  aiLimitSetMsg,
  codeRunningAllowedMsg,
  codeRunningTakenMsg,
  inviteCodeReady,
  inviteSentTo,
  olderReleasesGone,
  passwordLinkSentMsg,
  passwordSetForMsg,
  quotaSetTo,
  releaseDeletedMsg,
  releaseNowCurrentMsg,
  releaseNumberTaken,
  releaseReadyMsg,
} from "@/lib/i18n";

async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) throw new Error((await currentWords()).actAdminOnly);
  return admin;
}

async function writeToLog(actorId: string, action: string, details: string) {
  await prisma.auditEntry.create({ data: { actorId, action, details } });
}

export type Result = {
  error?: string;
  success?: string;
  copyable?: { value: string; label?: string };
};

// --- Invite codes ---

function newCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () =>
    Array.from(randomBytes(4))
      .map((byte) => alphabet[byte % alphabet.length])
      .join("");
  return `KAJET-${part()}-${part()}`;
}

const codeForm = z.object({
  // Minus jeden znaczy „bez ograniczeń", tak samo jak przy miejscu na
  // notatki. Zera nie ma po co przepuszczać: kod na zero kont to kod, którym
  // nie da się nic zrobić.
  /*
    Dwie liczby znaczą w całym formularzu to samo:

      0  - nic (konto bez miejsca, konto bez asystenta),
     -1  - bez ograniczeń (dowolnie wiele kont, miejsce bez limitu, kod
           bez terminu ważności).

    Zera nie ma po co przepuszczać tam, gdzie znaczyłoby „kod martwy w chwili
    wydania": ani zero kont, ani zero dni ważności nie są do niczego. Wcześniej
    zero w polu dni znaczyło „bez terminu", czyli w jednym formularzu to samo
    zero raz mówiło „nic", a raz „bez końca".
  */
  seats: z.coerce.number().int().min(-1).max(500).refine((value) => value !== 0),
  quotaMb: z.coerce.number().int().min(-1).max(1_048_576),
  validDays: z.coerce.number().int().min(-1).max(3650).refine((value) => value !== 0),
  description: z.string().trim().max(200).optional(),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  /*
    Ile razy dziennie konto z tego kodu może poprosić asystenta. Zero znaczy
    „bez asystenta" - jedna liczba zamiast znacznika „daj dostęp" obok pola
    „ile", bo dostęp bez limitu i limit bez dostępu to dwa stany, których nikt
    nie potrzebuje, a dało się je nastawić.
  */
  aiPerDay: z.coerce.number().int().min(0).max(10_000),
});

export async function createCode(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();

  const parsed = codeForm.safeParse({
    seats: data.get("seats") || 1,
    quotaMb: data.get("quotaMb") || 0,
    validDays: data.get("validDays") || 30,
    description: data.get("description") || "",
    email: data.get("email") || "",
    aiPerDay: data.get("aiPerDay") || 0,
  });
  if (!parsed.success) return { error: (await currentWords()).actCheckNumbers };

  const { seats, quotaMb, validDays, description, email, aiPerDay } = parsed.data;
  const code = newCode();
  const grantsAi = aiPerDay > 0;

  await prisma.inviteCode.create({
    data: {
      code,
      seats,
      // Liczba wpisana wprost, nigdy null: kod ma mówić, ile daje. Puste pole
      // zostało tylko w kodach wystawionych wcześniej i znaczy przy nich
      // „tyle, ile mówią ustawienia serwera" - czyli dziś zero.
      quotaBytes: quotaFromMb(quotaMb),
      // Znacznik i liczba idą razem, żeby jedno nie mówiło czegoś innego
      // niż drugie. Sam znacznik zostaje dla starszych kodów.
      grantsAi,
      aiDailyLimit: aiPerDay,
      // Ujemna liczba dni to kod bez terminu - puste pole w bazie.
      expiresAt: validDays < 0 ? null : new Date(Date.now() + validDays * 86_400_000),
      description: description || null,
      issuedById: admin.id,
    },
  });

  await writeToLog(
    admin.id,
    "code.created",
    `${code}, seats: ${seats < 0 ? "no limit" : seats}` +
      `, ${quotaMb < 0 ? "no limit" : `${quotaMb} MB`}` +
      `, ${validDays < 0 ? "no deadline" : `${validDays} days`}` +
      (grantsAi ? `, KajetAI ${aiPerDay}/doba` : ""),
  );

  const words = await currentWords();
  let note = "";
  if (email) {
    const link = `${settings.baseUrl}/register?code=${encodeURIComponent(code)}`;
    const sent = await send(inviteMail(email, link, admin.name ?? admin.login));
    note = sent ? ` ${inviteSentTo(words, email)}` : ` ${words.actInviteMailFailed}`;
  }

  revalidatePath("/admin/codes");
  return {
    success: `${inviteCodeReady(words, code)}${note}`,
    copyable: {
      value: `${settings.baseUrl}/register?code=${encodeURIComponent(code)}`,
      label: words.actCopyRegistrationLink,
    },
  };
}

export async function deleteCode(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const id = String(data.get("id") ?? "");
  if (!id) return { error: (await currentWords()).actWhichCode };

  await prisma.inviteCode.delete({ where: { id } });
  await writeToLog(admin.id, "code.deleted", id);

  revalidatePath("/admin/codes");
  return { success: (await currentWords()).actCodeDeleted };
}

// --- Accounts ---

const quotaForm = z.object({
  userId: z.string().min(1),
  // Ta sama zasada co przy kodzie zaproszenia: -1 to „bez ograniczeń", zero
  // to zero. Przy dniach „bez ograniczeń" znaczy „na stałe", a zero nie
  // znaczy nic - limit na zero dni jest limitem, który mija w tej samej
  // chwili, w której go nadano.
  quotaMb: z.coerce.number().int().min(-1).max(10_485_760),
  forDays: z.coerce.number().int().min(-1).max(3650).refine((value) => value !== 0),
});

/** Megabajty z formularza na bajty w bazie. -1 zostaje -1: bez ograniczeń. */
function quotaFromMb(quotaMb: number): bigint {
  return quotaMb < 0 ? -1n : BigInt(quotaMb) * 1024n * 1024n;
}

export async function setQuota(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();

  const parsed = quotaForm.safeParse({
    userId: data.get("userId"),
    quotaMb: data.get("quotaMb") ?? 0,
    forDays: data.get("forDays") ?? -1,
  });
  if (!parsed.success) return { error: (await currentWords()).actCheckNumbers };

  const { userId, quotaMb, forDays } = parsed.data;
  const quota = quotaFromMb(quotaMb);

  await prisma.user.update({
    where: { id: userId },
    data:
      forDays > 0
        ? {
            // A quota for a fixed period. The permanent quota is left alone,
            // because the account must fall back to it once the term is up.
            quotaBytes: quota,
            quotaUntil: new Date(Date.now() + forDays * 86_400_000),
          }
        : {
            quotaBytes: quota,
            permanentQuotaBytes: quota,
            quotaUntil: null,
          },
  });

  await writeToLog(
    admin.id,
    "account.quota",
    `${userId}: ${quotaMb < 0 ? "no limit" : `${quotaMb} MB`}` +
      (forDays > 0 ? `, for ${forDays} days` : ", permanently"),
  );

  revalidatePath("/admin/accounts");
  const words = await currentWords();
  return {
    success:
      quotaMb < 0
        ? words.actUnlimitedGiven
        : quotaMb === 0
          ? words.actNoSpaceGiven
          : quotaSetTo(words, quotaMb, forDays),
  };
}

export async function toggleBlock(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const userId = String(data.get("userId") ?? "");
  const reason = String(data.get("reason") ?? "").trim();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: (await currentWords()).apiNoSuchAccount };
  if (user.id === admin.id) return { error: (await currentWords()).actCannotBlockSelf };

  const blocking = !user.blocked;

  await prisma.user.update({
    where: { id: userId },
    data: {
      blocked: blocking,
      blockReason: blocking ? reason || null : null,
    },
  });

  // A blocked account must go out at once, not once its session expires.
  if (blocking) {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.appToken.deleteMany({ where: { userId } });
  }

  await writeToLog(
    admin.id,
    blocking ? "account.blocked" : "account.unblocked",
    `${user.login}${reason ? `: ${reason}` : ""}`,
  );

  revalidatePath("/admin/accounts");
  const words = await currentWords();
  return {
    success: blocking
      ? accountBlockedMsg(words, user.login)
      : accountUnblockedMsg(words, user.login),
  };
}

function loginForm(words: Words) {
  return z.object({
    userId: z.string().min(1),
    login: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[a-z0-9._-]{3,24}$/,
        words.actLoginRulesAdmin,
      ),
  });
}

export async function changeLogin(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();

  const parsed = loginForm(await currentWords()).safeParse({
    userId: data.get("userId"),
    login: data.get("login"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await currentWords()).actBadLogin };
  }

  const { userId, login } = parsed.data;

  const taken = await prisma.user.findUnique({ where: { login }, select: { id: true } });
  if (taken && taken.id !== userId) return { error: (await currentWords()).actLoginTaken };

  await prisma.user.update({ where: { id: userId }, data: { login } });
  await writeToLog(admin.id, "account.login", `${userId} -> ${login}`);

  revalidatePath("/admin/accounts");
  return { success: accountLoginNowMsg(await currentWords(), login) };
}

function emailForm(words: Words) {
  return z.object({
    userId: z.string().min(1),
    email: z.string().trim().toLowerCase().email(words.actNotAnEmail),
  });
}

export async function changeEmail(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();

  const parsed = emailForm(await currentWords()).safeParse({
    userId: data.get("userId"),
    email: data.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await currentWords()).actNotAnEmail };
  }

  const { userId, email } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: (await currentWords()).apiNoSuchAccount };
  if (user.email === email) return { error: (await currentWords()).actAccountHasAddress };

  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) return { error: (await currentWords()).actAddressOnAnother };

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { email, emailVerified: null } }),
    // Odnośniki wysłane na stary adres (zmiana hasła, potwierdzenie) nie mogą
    // dalej działać - dotyczą konta, które ma już inny adres.
    prisma.verificationToken.deleteMany({
      where: {
        identifier: {
          in: [`password:${user.email}`, `confirm:${user.email}`],
        },
      },
    }),
  ]);

  // Nowy adres czeka na potwierdzenie, tak samo jak przy rejestracji.
  const token = randomBytes(32).toString("base64url");
  await prisma.verificationToken.create({
    data: {
      identifier: `confirm:${email}`,
      token,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  const link = `${settings.baseUrl}/confirm?token=${token}`;
  const sent = await send(confirmationMail(email, link));

  await writeToLog(admin.id, "account.email", `${user.login}: ${user.email} -> ${email}`);

  revalidatePath("/admin/accounts");
  const words = await currentWords();
  return {
    success:
      accountEmailNowMsg(words, email) +
      (sent ? words.actConfirmationSent : words.actConfirmationFailed),
    copyable: sent ? undefined : { value: link, label: words.actCopyConfirmLink },
  };
}

export async function sendPasswordReset(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const userId = String(data.get("userId") ?? "");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: (await currentWords()).apiNoSuchAccount };

  const token = randomBytes(32).toString("base64url");

  // Starsze odnośniki przestają działać, tak samo jak przy prośbie ze strony.
  await prisma.verificationToken.deleteMany({ where: { identifier: `password:${user.email}` } });
  await prisma.verificationToken.create({
    data: {
      identifier: `password:${user.email}`,
      token,
      expires: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const link = `${settings.baseUrl}/password?token=${token}`;
  const sent = await send(passwordResetMail(user.email, link));

  await writeToLog(admin.id, "account.password.link", user.login);

  revalidatePath("/admin/accounts");
  const words = await currentWords();
  return {
    success: sent ? passwordLinkSentMsg(words, user.email) : words.actResetMailFailed,
    copyable: { value: link, label: words.copyLink },
  };
}

function newPasswordForm(words: Words) {
  return z.object({
    userId: z.string().min(1),
    password: z.string().min(8, words.actPasswordMinEight),
  });
}

export async function setUserPassword(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();

  const parsed = newPasswordForm(await currentWords()).safeParse({
    userId: data.get("userId"),
    password: data.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await currentWords()).actCheckWhatYouTyped };
  }

  const { userId, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: (await currentWords()).apiNoSuchAccount };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        // Nowe hasło zamyka konto na wszystkich urządzeniach - sesje strony
        // odpadają przez znacznik, tokeny aplikacji znikają z bazy.
        sessionsRevokedAt: new Date(),
      },
    }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.appToken.deleteMany({ where: { userId } }),
  ]);

  await writeToLog(admin.id, "account.password.set", user.login);

  revalidatePath("/admin/accounts");
  return { success: passwordSetForMsg(await currentWords(), user.login) };
}

export async function toggleAdmin(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const userId = String(data.get("userId") ?? "");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: (await currentWords()).apiNoSuchAccount };
  if (user.id === admin.id) return { error: (await currentWords()).actCannotTakeOwnRights };

  const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
  await prisma.user.update({ where: { id: userId }, data: { role: newRole } });
  await writeToLog(admin.id, "account.role", `${user.login} -> ${newRole}`);

  revalidatePath("/admin/accounts");
  const words = await currentWords();
  return {
    success:
      newRole === "ADMIN"
        ? adminRightsGivenMsg(words, user.login)
        : adminRightsTakenMsg(words, user.login),
  };
}

export async function toggleCodeRunning(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const userId = String(data.get("userId") ?? "");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: (await currentWords()).apiNoSuchAccount };

  const allowed = !user.canRunCode;
  await prisma.user.update({
    where: { id: userId },
    data: { canRunCode: allowed },
  });

  await writeToLog(admin.id, allowed ? "account.code.enabled" : "account.code.disabled", user.login);

  revalidatePath("/admin/accounts");
  const words = await currentWords();
  return {
    success: allowed
      ? codeRunningAllowedMsg(words, user.login)
      : codeRunningTakenMsg(words, user.login),
  };
}

/**
 * Nadanie i odebranie KajetAI.
 *
 * Odwrotnie niż uruchamianie kodu, które każdy dostaje z góry: tu domyślnie
 * nikt nie ma dostępu i to jest jedyne miejsce, w którym się go nadaje.
 * Zabranie uprawnienia nie kasuje zgody na wysyłanie treści do Google - to
 * decyzja właściciela konta, nie administratora, i nie ma powodu, żeby po
 * przywróceniu dostępu pytać o nią drugi raz.
 */
export async function toggleAi(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const userId = String(data.get("userId") ?? "");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: (await currentWords()).apiNoSuchAccount };

  const allowed = !user.canUseAi;
  await prisma.user.update({
    where: { id: userId },
    data: { canUseAi: allowed },
  });

  await writeToLog(admin.id, allowed ? "account.ai.enabled" : "account.ai.disabled", user.login);

  revalidatePath("/admin/accounts");
  const words = await currentWords();
  return {
    success: allowed
      ? aiAccessGivenMsg(words, user.login, !user.aiConsentAt)
      : aiAccessTakenMsg(words, user.login),
  };
}

/**
 * Limit wywołań KajetAI dla jednego konta. Zero zdejmuje własny limit i
 * konto wraca do domyślnego z ustawień serwera - tak samo jak przy miejscu.
 */
export async function setAiLimit(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();

  const parsed = z
    .object({ userId: z.string().min(1), perDay: z.coerce.number().int().min(0).max(10_000) })
    .safeParse({ userId: data.get("userId"), perDay: data.get("perDay") ?? 0 });
  if (!parsed.success) return { error: (await currentWords()).actCheckNumbers };

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) return { error: (await currentWords()).apiNoSuchAccount };

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { aiDailyLimit: parsed.data.perDay },
  });
  await writeToLog(admin.id, "account.ai.limit", `${user.login}: ${parsed.data.perDay}`);

  revalidatePath("/admin/accounts");
  const words = await currentWords();
  return {
    success:
      parsed.data.perDay === 0
        ? aiLimitDefaultMsg(words, user.login)
        : aiLimitSetMsg(words, user.login, parsed.data.perDay),
  };
}

export async function recomputeStorage(_previous: Result, data: FormData): Promise<Result> {
  await requireAdmin();
  const userId = String(data.get("userId") ?? "");
  if (!userId) return { error: (await currentWords()).actWhichAccount };

  await recomputeUsed(userId);
  revalidatePath("/admin/accounts");
  return { success: (await currentWords()).actStorageRecomputed };
}

export async function deleteUser(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const userId = String(data.get("userId") ?? "");

  if (userId === admin.id) return { error: (await currentWords()).actCannotDeleteOwnAccount };

  const removed = await removeAccount(userId);
  if (!removed) return { error: (await currentWords()).apiNoSuchAccount };

  await writeToLog(
    admin.id,
    "account.deleted",
    `${removed.login}, notatek: ${removed.noteCount}`,
  );

  revalidatePath("/admin/accounts");
  return { success: accountDeletedMsg(await currentWords(), removed.login) };
}

// --- Android application ---

function releaseForm(words: Words) {
  return z.object({
    version: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[0-9A-Za-z][0-9A-Za-z.\-_+ ]*$/, words.actVersionExample),
    versionCode: z.coerce.number().int().min(1).max(2_000_000_000),
    notes: z.string().trim().max(4000).optional(),
    fileName: z.string().trim().max(120).optional(),
    /** Skrót pliku, który przyszedł wcześniej na /admin/app/upload. */
    upload: z.string().regex(/^[0-9a-f]{64}$/, words.actPickApkFirst),
    replacePrevious: z.boolean(),
  });
}

function refreshAppPages() {
  revalidatePath("/admin/app");
  revalidatePath("/download");
  revalidatePath("/");
}

export async function publishRelease(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();

  const parsed = releaseForm(await currentWords()).safeParse({
    version: data.get("version") ?? "",
    versionCode: data.get("versionCode") ?? 0,
    notes: data.get("notes") ?? "",
    fileName: data.get("fileName") ?? "",
    upload: data.get("upload") ?? "",
    replacePrevious: data.get("replacePrevious") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await currentWords()).actCheckWhatYouTyped };
  }

  const { version, versionCode, notes, fileName, upload, replacePrevious } = parsed.data;

  // Plik przyszedł osobnym zapytaniem. Zanim zrobimy z niego wydanie, upewniamy
  // się, że nadal leży na dysku - mógł go sprzątnąć porządek albo drugi admin.
  const file = await uploadedFile(upload);
  if (!file) {
    return { error: (await currentWords()).actUploadLost };
  }

  /*
    Numer wydania bierzemy z pliku, nie z formularza.

    Aplikacja porównuje SWÓJ versionCode z tym, co odda serwer, więc pomyłka
    przy przepisywaniu znaczy albo komunikat o aktualizacji nie do zbicia, albo
    taki, który nie pojawi się nigdy. Formularz pokazuje odczytaną liczbę zaraz
    po wgraniu pliku i podaje ją tutaj z powrotem, ale ostatnie słowo ma i tak
    plik - przez to nie ma jak zapisać się numer wzięty z sufitu.

    Gdy odczyt się nie uda (plik z innego narzędzia, nieznana odmiana zapisu),
    zostaje to, co wpisał człowiek. Lepsze to niż odmowa wystawienia wydania.
  */
  const fromFile = await apkVersion(releasePath(upload));
  const releaseNumber = fromFile?.versionCode ?? versionCode;

  const clash = await prisma.appRelease.findUnique({ where: { versionCode: releaseNumber } });
  if (clash) {
    return {
      error: releaseNumberTaken(await currentWords(), releaseNumber, clash.version),
    };
  }

  const created = await prisma.$transaction(async (tx) => {
    // Aktualne wydanie jest jedno, więc poprzednie przestaje nim być.
    await tx.appRelease.updateMany({ where: { current: true }, data: { current: false } });
    return tx.appRelease.create({
      data: {
        version,
        versionCode: releaseNumber,
        notes: notes || null,
        fileName: fileName || `kajet-${version}.apk`,
        hash: upload,
        sizeBytes: file.sizeBytes,
        current: true,
        uploadedById: admin.id,
      },
    });
  });

  let note = "";
  if (replacePrevious) {
    const older = await prisma.appRelease.findMany({
      where: { id: { not: created.id } },
      select: { id: true, hash: true },
    });
    if (older.length > 0) {
      await prisma.appRelease.deleteMany({ where: { id: { not: created.id } } });
      for (const release of older) await forgetFile(release.hash);
      note = ` ${olderReleasesGone(await currentWords(), older.length)}`;
    }
  }

  await sweepUnused();
  await writeToLog(admin.id, "app.published", `${version} (${releaseNumber})`);

  refreshAppPages();
  const words = await currentWords();
  return {
    success: `${releaseReadyMsg(words, version)}${note}`,
    copyable: { value: `${settings.baseUrl}/download`, label: words.actCopyDownloadLink },
  };
}

export async function makeReleaseCurrent(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const id = String(data.get("id") ?? "");

  const release = await prisma.appRelease.findUnique({ where: { id } });
  if (!release) return { error: (await currentWords()).actNoSuchRelease };

  await prisma.$transaction([
    prisma.appRelease.updateMany({ where: { current: true }, data: { current: false } }),
    prisma.appRelease.update({ where: { id }, data: { current: true } }),
  ]);

  await writeToLog(admin.id, "app.current", `${release.version} (${release.versionCode})`);

  refreshAppPages();
  return { success: releaseNowCurrentMsg(await currentWords(), release.version) };
}

export async function deleteRelease(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const id = String(data.get("id") ?? "");

  const release = await prisma.appRelease.findUnique({ where: { id } });
  if (!release) return { error: (await currentWords()).actNoSuchRelease };

  await prisma.appRelease.delete({ where: { id } });
  await forgetFile(release.hash);

  // Po skasowaniu tego, co było na stronie, wskakuje na jego miejsce najnowsze
  // z pozostałych - inaczej strona pobierania zostałaby pusta.
  let note = "";
  if (release.current) {
    const next = await prisma.appRelease.findFirst({ orderBy: { versionCode: "desc" } });
    if (next) {
      await prisma.appRelease.update({ where: { id: next.id }, data: { current: true } });
      note = ` ${releaseNowCurrentMsg(await currentWords(), next.version)}`;
    } else {
      note = (await currentWords()).actNoReleaseLeft;
    }
  }

  await writeToLog(admin.id, "app.deleted", `${release.version} (${release.versionCode})`);

  refreshAppPages();
  return { success: `${releaseDeletedMsg(await currentWords(), release.version)}${note}` };
}
