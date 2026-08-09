"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { passwordResetMail, send } from "@/lib/mail";
import { settings } from "@/lib/settings";
import { currentWords } from "@/lib/language";
import type { Words } from "@/lib/i18n";

export type Result = { error?: string; success?: string };

const KEY = "password:";

export async function requestLink(_previous: Result, data: FormData): Promise<Result> {
  const email = String(data.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) {
    return { error: (await currentWords()).actNotAnEmail };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // The same answer whether or not the account exists. Otherwise it would be
  // possible to check who has an account on this server.
  const answer: Result = {
    success:
      (await currentWords()).actResetLinkSent,
  };

  if (!user) return answer;

  // An account created through Google only has no password and nothing to change.
  if (!user.passwordHash) return answer;

  const token = randomBytes(32).toString("base64url");

  // Older requests stop working once a new one arrives.
  await prisma.verificationToken.deleteMany({ where: { identifier: `${KEY}${email}` } });
  await prisma.verificationToken.create({
    data: {
      identifier: `${KEY}${email}`,
      token,
      expires: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  await send(passwordResetMail(email, `${settings.baseUrl}/password?token=${token}`));
  return answer;
}

function newPasswordForm(words: Words) {
  return z.object({
    token: z.string().min(1),
    password: z.string().min(8, words.actPasswordMinEight),
    passwordRepeat: z.string(),
  });
}

export async function setNewPassword(_previous: Result, data: FormData): Promise<Result> {
  const parsed = newPasswordForm(await currentWords()).safeParse({
    token: data.get("token"),
    password: data.get("password"),
    passwordRepeat: data.get("passwordRepeat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await currentWords()).actCheckWhatYouTyped };
  }

  const { token, password, passwordRepeat } = parsed.data;
  if (password !== passwordRepeat) return { error: (await currentWords()).actPasswordsDifferTwice };

  const entry = await prisma.verificationToken.findUnique({ where: { token } });
  if (!entry || !entry.identifier.startsWith(KEY)) {
    return { error: (await currentWords()).actLinkDeadAskNew };
  }
  if (entry.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    return { error: (await currentWords()).actLinkExpiredHour };
  }

  const email = entry.identifier.slice(KEY.length);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return { error: (await currentWords()).actNoAccountOnAddress };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        // Sesje strony to podpisane ciasteczka (JWT) - kasowanie tabeli nie
        // wystarczy, znacznik odrzuca każdą sesję wydaną przed zmianą hasła.
        sessionsRevokedAt: new Date(),
      },
    }),
    prisma.verificationToken.delete({ where: { token } }),
    // Changing the password throws out every session and device token. If
    // somebody is changing their password because a stranger got in, that is
    // exactly what they want.
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.appToken.deleteMany({ where: { userId: user.id } }),
  ]);

  return {
    success:
      (await currentWords()).actPasswordChangedEverywhere,
  };
}
