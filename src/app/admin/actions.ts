"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recomputeUsed } from "@/lib/quota";
import { inviteMail, send } from "@/lib/mail";
import { settings } from "@/lib/settings";

async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) throw new Error("Ta czynność jest tylko dla administratora.");
  return admin;
}

async function writeToLog(actorId: string, action: string, details: string) {
  await prisma.auditEntry.create({ data: { actorId, action, details } });
}

export type Result = { error?: string; success?: string };

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
});

export async function createCode(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();

  const parsed = codeForm.safeParse({
    seats: data.get("seats") || 1,
    quotaMb: data.get("quotaMb") || 0,
    validDays: data.get("validDays") || 0,
    description: data.get("description") || "",
    email: data.get("email") || "",
  });
  if (!parsed.success) return { error: "Sprawdź wpisane liczby." };

  const { seats, quotaMb, validDays, description, email } = parsed.data;
  const code = newCode();

  await prisma.inviteCode.create({
    data: {
      code,
      seats,
      // Zero in the quota field means "as by default", not "no quota".
      // No quota is set on the account itself, once it has been created.
      quotaBytes: quotaMb > 0 ? BigInt(quotaMb) * 1024n * 1024n : null,
      expiresAt: validDays > 0 ? new Date(Date.now() + validDays * 86_400_000) : null,
      description: description || null,
      issuedById: admin.id,
    },
  });

  await writeToLog(admin.id, "code.created", `${code}, seats: ${seats}`);

  let note = "";
  if (email) {
    const link = `${settings.baseUrl}/register?code=${encodeURIComponent(code)}`;
    const sent = await send(inviteMail(email, link, admin.name ?? admin.login));
    note = sent
      ? ` Zaproszenie poszło na ${email}.`
      : ` Maila nie udało się wysłać, przekaż odnośnik samodzielnie.`;
  }

  revalidatePath("/admin/codes");
  return { success: `Kod ${code} gotowy.${note}` };
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
  if (!parsed.success) return { error: "Sprawdź wpisane liczby." };

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
        ? "Konto dostało miejsce bez limitu."
        : `Limit ustawiony na ${quotaMb} MB${forDays > 0 ? ` na ${forDays} dni` : ""}.`,
  };
}

export async function toggleBlock(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const userId = String(data.get("userId") ?? "");
  const reason = String(data.get("reason") ?? "").trim();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Nie ma takiego konta." };
  if (user.id === admin.id) return { error: "Nie da się zablokować własnego konta." };

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

const loginForm = z.object({
  userId: z.string().min(1),
  login: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9._-]{3,24}$/,
      "Login może mieć od 3 do 24 znaków: małe litery, cyfry, kropka, kreska, podkreślenie.",
    ),
});

export async function changeLogin(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();

  const parsed = loginForm.safeParse({
    userId: data.get("userId"),
    login: data.get("login"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Zły login." };
  }

  const { userId, login } = parsed.data;

  const taken = await prisma.user.findUnique({ where: { login }, select: { id: true } });
  if (taken && taken.id !== userId) return { error: "Ten login jest już zajęty." };

  await prisma.user.update({ where: { id: userId }, data: { login } });
  await writeToLog(admin.id, "account.login", `${userId} -> ${login}`);

  revalidatePath("/admin/accounts");
  return { success: `Login zmieniony na ${login}.` };
}

export async function toggleAdmin(_previous: Result, data: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const userId = String(data.get("userId") ?? "");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Nie ma takiego konta." };
  if (user.id === admin.id) return { error: "Nie da się odebrać uprawnień samemu sobie." };

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

export async function recomputeStorage(_previous: Result, data: FormData): Promise<Result> {
  await requireAdmin();
  const userId = String(data.get("userId") ?? "");
  if (!userId) return { error: "Brak konta." };

  await recomputeUsed(userId);
  revalidatePath("/admin/accounts");
  return { success: "Zajęte miejsce przeliczone od nowa." };
}
