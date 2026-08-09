"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { freeLogin, signIn } from "@/lib/auth";
import { checkInvite, rememberInvite } from "@/lib/invite";
import { confirmationMail, send } from "@/lib/mail";
import { settings } from "@/lib/settings";
import { currentWords } from "@/lib/language";
import type { Words } from "@/lib/i18n";

function form(words: Words) {
  return z.object({
    code: z.string().trim().min(4, "Wpisz kod zaproszenia."),
    email: z.string().trim().toLowerCase().email(words.actNotAnEmail),
    login: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[a-z0-9._-]{3,24}$/,
        words.actLoginRules,
      )
      .optional()
      .or(z.literal("")),
    password: z.string().min(8, words.actPasswordMinEight),
    passwordRepeat: z.string(),
  });
}

export type RegistrationResult = {
  error?: string;
  success?: string;
};

export async function register(
  _previous: RegistrationResult,
  data: FormData,
): Promise<RegistrationResult> {
  const parsed = form(await currentWords()).safeParse({
    code: data.get("code"),
    email: data.get("email"),
    login: data.get("login"),
    password: data.get("password"),
    passwordRepeat: data.get("passwordRepeat"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await currentWords()).actCheckWhatYouTyped };
  }

  const { code, email, login, password, passwordRepeat } = parsed.data;

  if (password !== passwordRepeat) {
    return { error: (await currentWords()).actPasswordsDifferTwice };
  }

  const checked = await checkInvite(code);
  if ("error" in checked) return { error: checked.error };
  const invite = checked.invite;

  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) {
    return { error: (await currentWords()).actEmailTaken };
  }

  const chosenLogin = login || (await freeLogin(email));
  if (login) {
    const takenLogin = await prisma.user.findUnique({
      where: { login: chosenLogin },
      select: { id: true },
    });
    if (takenLogin) return { error: (await currentWords()).actLoginTakenPickAnother };
  }

  const quota = invite.quotaBytes ?? BigInt(settings.quotas.default);

  // The account and the spending of the code in one transaction. Should saving
  // the account fail, the code must stay free rather than be lost.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        login: chosenLogin,
        passwordHash: await bcrypt.hash(password, 12),
        quotaBytes: quota,
        permanentQuotaBytes: quota,
      },
      select: { id: true, email: true },
    });

    await tx.inviteCode.update({
      where: { id: invite.id },
      data: {
        usedSeats: { increment: 1 },
        usedById: invite.seats === 1 ? created.id : undefined,
      },
    });

    return created;
  });

  await sendConfirmation(user.email);

  return {
    success:
      (await currentWords()).actAccountCreated,
  };
}

/**
 * Zakładanie konta Google. Sprawdzamy kod, zapamiętujemy go w ciasteczku i od
 * razu przerzucamy na Google - o adres nie pytamy, bo przyjdzie od Google.
 * Wraca stąd tylko błąd; przy dobrym kodzie signIn rzuca przekierowaniem.
 */
export async function startGoogleWithCode(
  _previous: RegistrationResult,
  data: FormData,
): Promise<RegistrationResult> {
  const code = String(data.get("code") ?? "").trim();

  const checked = await checkInvite(code);
  if ("error" in checked) return { error: checked.error };

  await rememberInvite(checked.invite.code);
  await signIn("google", { redirectTo: "/library" });
  return {};
}

async function sendConfirmation(email: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await prisma.verificationToken.create({
    data: {
      identifier: `confirm:${email}`,
      token,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const link = `${settings.baseUrl}/confirm?token=${token}`;
  await send(confirmationMail(email, link));
}
