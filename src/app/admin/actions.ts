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
  seats: z.coerce.number().int().min(1).max(500),
  quotaMb: z.coerce.number().int().min(0).max(1_048_576),
  validDays: z.coerce.number().int().min(0).max(3650),
  description: z.string().trim().max(200).optional(),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  grantsAi: z.boolean(),
});

export async function createCode(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();

  const parsed = codeForm.safeParse({
    seats: data.get("seats") || 1,
    quotaMb: data.get("quotaMb") || 0,
    validDays: data.get("validDays") || 0,
    description: data.get("description") || "",
    email: data.get("email") || "",
    grantsAi: data.get("grantsAi") === "on",
  });
  if (!parsed.success) return { error: (await currentWords()).actCheckNumbers };

  const { seats, quotaMb, validDays, description, email, grantsAi } = parsed.data;
  const code = newCode();

  await prisma.inviteCode.create({
    data: {
      code,
      seats,
      // Zero in the quota field means "as by default", not "no quota".
      // No quota is set on the account itself, once it has been created.
      quotaBytes: quotaMb > 0 ? BigInt(quotaMb) * 1024n * 1024n : null,
      grantsAi,
      expiresAt: validDays > 0 ? new Date(Date.now() + validDays * 86_400_000) : null,
      description: description || null,
      issuedById: admin.id,
    },
  });

  await writeToLog(
    admin.id,
    "code.created",
    `${code}, seats: ${seats}${grantsAi ? ", z asystentem AI" : ""}`,
  );

  let note = "";
  if (email) {
    const link = `${settings.baseUrl}/register?code=${encodeURIComponent(code)}`;
    const sent = await send(inviteMail(email, link, admin.name ?? admin.login));
    note = sent
      ? ` Zaproszenie poszło na ${email}.`
      : ` Maila nie udało się wysłać, przekaż odnośnik samodzielnie.`;
  }

  revalidatePath("/admin/codes");
  return {
    success: `Kod ${code} gotowy.${note}`,
    copyable: {
      value: `${settings.baseUrl}/register?code=${encodeURIComponent(code)}`,
      label: (await currentWords()).actCopyRegistrationLink,
    },
  };
}

export async function deleteCode(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const id = String(data.get("id") ?? "");
  if (!id) return { error: "Brak kodu do skasowania." };

  await prisma.inviteCode.delete({ where: { id } });
  await writeToLog(admin.id, "code.deleted", id);

  revalidatePath("/admin/codes");
  return { success: "Kod skasowany." };
}

// --- Accounts ---

const quotaForm = z.object({
  userId: z.string().min(1),
quotaMb: z.coerce.number().int().min(0).max(10_485_760),
forDays: z.coerce.number().int().min(0).max(3650),
});

export async function setQuota(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();

  const parsed = quotaForm.safeParse({
    userId: data.get("userId"),
    quotaMb: data.get("quotaMb") ?? 0,
    forDays: data.get("forDays") ?? 0,
  });
  if (!parsed.success) return { error: (await currentWords()).actCheckNumbers };

  const { userId, quotaMb, forDays } = parsed.data;
  const quota = BigInt(quotaMb) * 1024n * 1024n;

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
    `${userId}: ${quotaMb === 0 ? "no quota" : `${quotaMb} MB`}` +
      (forDays > 0 ? `, for ${forDays} days` : ", permanently"),
  );

  revalidatePath("/admin/accounts");
  return {
    success:
      quotaMb === 0
        ? (await currentWords()).actUnlimitedGiven
        : `Limit ustawiony na ${quotaMb} MB${forDays > 0 ? ` na ${forDays} dni` : ""}.`,
  };
}

export async function toggleBlock(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const userId = String(data.get("userId") ?? "");
  const reason = String(data.get("reason") ?? "").trim();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Nie ma takiego konta." };
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
  return {
    success: blocking
      ? `Konto ${user.login} zablokowane i wylogowane ze wszystkich urządzeń.`
      : `Konto ${user.login} odblokowane.`,
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
  return { success: `Login zmieniony na ${login}.` };
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
  if (!user) return { error: "Nie ma takiego konta." };
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
  return {
    success:
      `Adres zmieniony na ${email}.` +
      (sent
        ? (await currentWords()).actConfirmationSent
        : (await currentWords()).actConfirmationFailed),
    copyable: sent ? undefined : { value: link, label: (await currentWords()).actCopyConfirmLink },
  };
}

export async function sendPasswordReset(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const userId = String(data.get("userId") ?? "");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Nie ma takiego konta." };

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
  return {
    success: sent
      ? `Odnośnik do zmiany hasła poszedł na ${user.email}. Jest ważny przez godzinę.`
      : (await currentWords()).actResetMailFailed,
    copyable: { value: link, label: (await currentWords()).copyLink },
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
  if (!user) return { error: "Nie ma takiego konta." };

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
  return {
    success: `Hasło dla ${user.login} ustawione. Konto zostało wylogowane ze wszystkich urządzeń.`,
  };
}

export async function toggleAdmin(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const userId = String(data.get("userId") ?? "");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Nie ma takiego konta." };
  if (user.id === admin.id) return { error: (await currentWords()).actCannotTakeOwnRights };

  const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
  await prisma.user.update({ where: { id: userId }, data: { role: newRole } });
  await writeToLog(admin.id, "account.role", `${user.login} -> ${newRole}`);

  revalidatePath("/admin/accounts");
  return {
    success:
      newRole === "ADMIN"
        ? `${user.login} ma teraz uprawnienia administratora.`
        : `${user.login} jest znowu zwykłym użytkownikiem.`,
  };
}

export async function toggleCodeRunning(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const userId = String(data.get("userId") ?? "");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Nie ma takiego konta." };

  const allowed = !user.canRunCode;
  await prisma.user.update({
    where: { id: userId },
    data: { canRunCode: allowed },
  });

  await writeToLog(admin.id, allowed ? "account.code.enabled" : "account.code.disabled", user.login);

  revalidatePath("/admin/accounts");
  return {
    success: allowed
      ? `${user.login} może znowu uruchamiać kod na serwerze.`
      : `${user.login} nie uruchomi już kodu na serwerze. Pisać i zapisywać nadal może.`,
  };
}

/**
 * Nadanie i odebranie asystenta AI.
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
  if (!user) return { error: "Nie ma takiego konta." };

  const allowed = !user.canUseAi;
  await prisma.user.update({
    where: { id: userId },
    data: { canUseAi: allowed },
  });

  await writeToLog(admin.id, allowed ? "account.ai.enabled" : "account.ai.disabled", user.login);

  revalidatePath("/admin/accounts");
  return {
    success: allowed
      ? `${user.login} może teraz prosić asystenta o zmiany w notatkach.` +
        (user.aiConsentAt ? "" : " Zgodę na wysyłanie treści potwierdzi u siebie w ustawieniach.")
      : `${user.login} nie ma już dostępu do asystenta. Notatki zostają nietknięte.`,
  };
}

/**
 * Limit wywołań asystenta dla jednego konta. Zero zdejmuje własny limit i
 * konto wraca do domyślnego z ustawień serwera - tak samo jak przy miejscu.
 */
export async function setAiLimit(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();

  const parsed = z
    .object({ userId: z.string().min(1), perDay: z.coerce.number().int().min(0).max(10_000) })
    .safeParse({ userId: data.get("userId"), perDay: data.get("perDay") ?? 0 });
  if (!parsed.success) return { error: (await currentWords()).actCheckNumbers };

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) return { error: "Nie ma takiego konta." };

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { aiDailyLimit: parsed.data.perDay },
  });
  await writeToLog(admin.id, "account.ai.limit", `${user.login}: ${parsed.data.perDay}`);

  revalidatePath("/admin/accounts");
  return {
    success:
      parsed.data.perDay === 0
        ? `${user.login} wraca do domyślnego limitu wywołań asystenta.`
        : `${user.login} ma teraz ${parsed.data.perDay} wywołań asystenta na dobę.`,
  };
}

export async function recomputeStorage(_previous: Result, data: FormData): Promise<Result> {
  await requireAdmin();
  const userId = String(data.get("userId") ?? "");
  if (!userId) return { error: "Brak konta." };

  await recomputeUsed(userId);
  revalidatePath("/admin/accounts");
  return { success: (await currentWords()).actStorageRecomputed };
}

export async function deleteUser(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const userId = String(data.get("userId") ?? "");

  if (userId === admin.id) return { error: (await currentWords()).actCannotDeleteOwnAccount };

  const removed = await removeAccount(userId);
  if (!removed) return { error: "Nie ma takiego konta." };

  await writeToLog(
    admin.id,
    "account.deleted",
    `${removed.login}, notatek: ${removed.noteCount}`,
  );

  revalidatePath("/admin/accounts");
  return { success: `Konto ${removed.login} skasowane razem ze wszystkim, co na nim było.` };
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
      error: `Numer wydania ${releaseNumber} ma już wersja ${clash.version}. Podnieś numer albo skasuj tamto wydanie.`,
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
      note = ` Starsze wydania (${older.length}) poszły z bazy i z dysku.`;
    }
  }

  await sweepUnused();
  await writeToLog(admin.id, "app.published", `${version} (${releaseNumber})`);

  refreshAppPages();
  return {
    success: `Wersja ${version} jest już do pobrania.${note}`,
    copyable: { value: `${settings.baseUrl}/download`, label: (await currentWords()).actCopyDownloadLink },
  };
}

export async function makeReleaseCurrent(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const id = String(data.get("id") ?? "");

  const release = await prisma.appRelease.findUnique({ where: { id } });
  if (!release) return { error: "Nie ma takiego wydania." };

  await prisma.$transaction([
    prisma.appRelease.updateMany({ where: { current: true }, data: { current: false } }),
    prisma.appRelease.update({ where: { id }, data: { current: true } }),
  ]);

  await writeToLog(admin.id, "app.current", `${release.version} (${release.versionCode})`);

  refreshAppPages();
  return { success: `Do pobrania idzie teraz wersja ${release.version}.` };
}

export async function deleteRelease(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const id = String(data.get("id") ?? "");

  const release = await prisma.appRelease.findUnique({ where: { id } });
  if (!release) return { error: "Nie ma takiego wydania." };

  await prisma.appRelease.delete({ where: { id } });
  await forgetFile(release.hash);

  // Po skasowaniu tego, co było na stronie, wskakuje na jego miejsce najnowsze
  // z pozostałych - inaczej strona pobierania zostałaby pusta.
  let note = "";
  if (release.current) {
    const next = await prisma.appRelease.findFirst({ orderBy: { versionCode: "desc" } });
    if (next) {
      await prisma.appRelease.update({ where: { id: next.id }, data: { current: true } });
      note = ` Do pobrania idzie teraz wersja ${next.version}.`;
    } else {
      note = (await currentWords()).actNoReleaseLeft;
    }
  }

  await writeToLog(admin.id, "app.deleted", `${release.version} (${release.versionCode})`);

  refreshAppPages();
  return { success: `Wydanie ${release.version} skasowane z bazy i z dysku.${note}` };
}
