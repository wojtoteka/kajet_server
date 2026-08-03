"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { currentUser, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { issueToken } from "@/lib/app-token";

export type Result = { error?: string; success?: string };

export async function logOut(): Promise<void> {
  await signOut({ redirectTo: "/signin" });
}

export async function issueAppToken(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const device = String(data.get("device") ?? "").trim() || "Tablet";
  const { token } = await issueToken(user.id, device);

  revalidatePath("/account");
  return {
    success:
      `Token dla urządzenia „${device}". Przepisz go do aplikacji teraz, ` +
      `bo drugi raz go nie pokażemy:\n\n${token}`,
  };
}

export async function revokeDevice(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const id = String(data.get("id") ?? "");
  const removed = await prisma.appToken.deleteMany({
    where: { id, userId: user.id },
  });

  revalidatePath("/account");
  return removed.count > 0
    ? { success: "Token unieważniony. Aplikacja na tym urządzeniu poprosi o ponowne zalogowanie." }
    : { error: "Nie ma już takiego tokenu." };
}

export async function revokeAllDevices(_previous: Result, _data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const removed = await prisma.appToken.deleteMany({ where: { userId: user.id } });
  revalidatePath("/account");
  return removed.count > 0
    ? {
        success: `Unieważniono ${removed.count} ${
          removed.count === 1 ? "token" : removed.count < 5 ? "tokeny" : "tokenów"
        }. Zaloguj tablety od nowa.`,
      }
    : { error: "Nie ma żadnych tokenów do unieważnienia." };
}

const passwordForm = z.object({
  current: z.string(),
  next: z.string().min(8, "Nowe hasło musi mieć co najmniej osiem znaków."),
  repeat: z.string(),
});

export async function changePassword(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const parsed = passwordForm.safeParse({
    current: data.get("current") ?? "",
    next: data.get("next"),
    repeat: data.get("repeat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Sprawdź wpisane dane." };
  }

  const { current, next, repeat } = parsed.data;
  if (next !== repeat) return { error: "Nowe hasła się różnią." };

  // An account with a password must give the old one. An account created
  // through Google has no password and is setting one now, so there is
  // nothing to check.
  if (user.passwordHash) {
    if (!current) return { error: "Podaj dotychczasowe hasło." };
    if (!(await bcrypt.compare(current, user.passwordHash))) {
      return { error: "Dotychczasowe hasło się nie zgadza." };
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 12) },
  });

  revalidatePath("/account");
  return {
    success: user.passwordHash
      ? "Hasło zmienione."
      : "Hasło ustawione. Możesz się teraz logować adresem i hasłem, także w aplikacji na tablecie.",
  };
}

export async function changeOwnLogin(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const login = String(data.get("login") ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,24}$/.test(login)) {
    return {
      error:
        "Login może mieć od 3 do 24 znaków: małe litery, cyfry, kropka, kreska i podkreślenie.",
    };
  }

  const taken = await prisma.user.findUnique({ where: { login }, select: { id: true } });
  if (taken && taken.id !== user.id) return { error: "Ten login jest już zajęty." };

  await prisma.user.update({ where: { id: user.id }, data: { login } });
  revalidatePath("/account");
  return { success: `Login zmieniony na ${login}.` };
}
