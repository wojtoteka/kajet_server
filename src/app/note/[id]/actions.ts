"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth";
import { shareMail, send } from "@/lib/mail";
import { settings } from "@/lib/settings";
import { shareUrl, createShare } from "@/lib/sharing";

export type Result = { error?: string; success?: string };

const form = z.object({
  noteId: z.string().min(1),
  permission: z.enum(["READ", "EDIT"]),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  anonymousAllowed: z.union([z.literal("on"), z.literal("")]).optional(),
  validDays: z.coerce.number().int().min(0).max(3650).optional(),
});

export async function share(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const parsed = form.safeParse({
    noteId: data.get("noteId"),
    permission: data.get("permission") ?? "READ",
    email: data.get("email") ?? "",
    anonymousAllowed: data.get("anonymousAllowed") ?? "",
    validDays: data.get("validDays") ?? 0,
  });
  if (!parsed.success) return { error: "Sprawdź wpisane dane." };

  const { noteId, permission, email, anonymousAllowed, validDays } = parsed.data;

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, title: true, ownerId: true },
  });
  if (!note) return { error: "Nie ma takiej notatki." };
  if (note.ownerId !== user.id) {
    return { error: "Udostępnić można tylko własną notatkę." };
  }

  const token = await createShare({
    noteId,
    sharedById: user.id,
    permission,
    email: email || null,
    anonymousAllowed: anonymousAllowed === "on",
    expiresInDays: validDays && validDays > 0 ? validDays : null,
  });

  const link = shareUrl(settings.baseUrl, token);
  revalidatePath(`/note/${noteId}`);

  if (email) {
    const sent = await send(
      shareMail(
        email,
        link,
        user.name ?? user.login,
        note.title || "Bez nazwy",
        permission === "EDIT",
      ),
    );
    return {
      success: sent
        ? `Wysłaliśmy wiadomość na ${email}.`
        : `Udostępnienie gotowe, ale maila nie udało się wysłać. Przekaż odnośnik samodzielnie: ${link}`,
    };
  }

  return { success: `Odnośnik gotowy: ${link}` };
}

export async function revokeShare(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const id = String(data.get("id") ?? "");
  const existing = await prisma.share.findUnique({
    where: { id },
    include: { note: { select: { id: true, ownerId: true } } },
  });

  if (!existing) return { success: "Tego udostępnienia już nie ma." };
  if (existing.note.ownerId !== user.id) {
    return { error: "To nie jest Twoja notatka." };
  }

  await prisma.share.delete({ where: { id } });
  revalidatePath(`/note/${existing.note.id}`);

  return { success: "Udostępnienie cofnięte. Ten odnośnik przestał działać." };
}
