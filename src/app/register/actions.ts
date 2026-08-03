"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { freeLogin } from "@/lib/auth";
import { confirmationMail, send } from "@/lib/mail";
import { settings } from "@/lib/settings";

const form = z.object({
  code: z.string().trim().min(4, "Wpisz kod zaproszenia."),
  email: z.string().trim().toLowerCase().email("To nie wygląda na adres e-mail."),
  login: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9._-]{3,24}$/,
      "Login może mieć od 3 do 24 znaków: małe litery, cyfry, kropka, kreska i podkreślenie.",
    )
    .optional()
    .or(z.literal("")),
  password: z.string().min(8, "Hasło musi mieć co najmniej osiem znaków."),
  passwordRepeat: z.string(),
});

export type RegistrationResult = {
  error?: string;
  success?: string;
};

export async function register(
  _previous: RegistrationResult,
  data: FormData,
): Promise<RegistrationResult> {
  const parsed = form.safeParse({
    code: data.get("code"),
    email: data.get("email"),
    login: data.get("login"),
    password: data.get("password"),
    passwordRepeat: data.get("passwordRepeat"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Sprawdź wpisane dane." };
  }

  const { code, email, login, password, passwordRepeat } = parsed.data;

  if (password !== passwordRepeat) {
    return { error: "Hasła się różnią. Wpisz to samo hasło dwa razy." };
  }

  const invite = await prisma.inviteCode.findUnique({ where: { code } });
  if (!invite) {
    return { error: "Nie ma takiego kodu. Sprawdź, czy przepisałeś go dokładnie." };
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return { error: "Ten kod już wygasł. Poproś administratora o nowy." };
  }
  if (invite.usedSeats >= invite.seats) {
    return { error: "Ten kod został już wykorzystany. Poproś administratora o nowy." };
  }

  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) {
    return { error: "Na ten adres jest już założone konto. Zaloguj się albo odzyskaj hasło." };
  }

  const chosenLogin = login || (await freeLogin(email));
  if (login) {
    const takenLogin = await prisma.user.findUnique({
      where: { login: chosenLogin },
      select: { id: true },
    });
    if (takenLogin) return { error: "Ten login jest już zajęty. Wybierz inny." };
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
      "Konto założone. Wysłaliśmy wiadomość z potwierdzeniem adresu. Możesz się już zalogować.",
  };
}

export async function parkCodeForGoogle(
  code: string,
  email: string,
): Promise<RegistrationResult> {
  const cleanCode = code.trim();
  const address = email.trim().toLowerCase();
  if (!cleanCode || !address) {
    return { error: "Podaj kod i adres, na który masz konto Google." };
  }

  const invite = await prisma.inviteCode.findUnique({ where: { code: cleanCode } });
  if (!invite) return { error: "Nie ma takiego kodu." };
  if (invite.expiresAt && invite.expiresAt < new Date()) return { error: "Ten kod już wygasł." };
  if (invite.usedSeats >= invite.seats) {
    return { error: "Ten kod został już wykorzystany." };
  }

  await prisma.verificationToken.deleteMany({ where: { identifier: `code:${address}` } });
  await prisma.verificationToken.create({
    data: {
      identifier: `code:${address}`,
      token: cleanCode,
      expires: new Date(Date.now() + 30 * 60 * 1000),
    },
  });

  return { success: "Kod przyjęty. Zaloguj się teraz przez Google na ten sam adres." };
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
