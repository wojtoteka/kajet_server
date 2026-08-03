"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth";
import { shareMail, send } from "@/lib/mail";
import { settings } from "@/lib/settings";
import { shareUrl, createShare } from "@/lib/sharing";
import { upsertNoteForUser } from "@/lib/note-write";
import { buildTextNoteContent, parseExistingTextDocument } from "@/lib/text-note";

export type Result = { error?: string; success?: string };

const textNoteForm = z.object({
  noteId: z.string().min(1).max(64).optional(),
  title: z.string().max(300),
  markdown: z.string().max(2_000_000),
  baseVersion: z.coerce.number().int().min(0).optional(),
});

export async function saveTextNote(_previous: Result, data: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "Musisz się zalogować." };

  const parsed = textNoteForm.safeParse({
    noteId: data.get("noteId") || undefined,
    title: data.get("title") ?? "",
    markdown: data.get("markdown") ?? "",
    baseVersion: data.get("baseVersion") ?? 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Sprawdź wpisane dane." };
  }

  const title = parsed.data.title.trim() || "Bez nazwy";
  const markdown = parsed.data.markdown;
  const existingId = parsed.data.noteId;

  let noteId = existingId;
  let existingDocument = null;
  let baseVersion = parsed.data.baseVersion ?? 0;

  if (existingId) {
    const row = await prisma.note.findUnique({
      where: { id: existingId },
      select: { id: true, ownerId: true, kind: true, content: true, version: true, deletedAt: true },
    });
    if (!row || row.deletedAt) return { error: "Nie ma takiej notatki." };
    if (row.ownerId !== user.id) return { error: "To nie jest Twoja notatka." };
    if (row.kind !== "TEXT") {
      return { error: "Na stronie da się na razie poprawiać tylko notatki tekstowe." };
    }
    existingDocument = parseExistingTextDocument(row.content);
    // Prefer the version the form was rendered with; fall back to current.
    if (baseVersion <= 0) baseVersion = row.version;
  } else {
    noteId = randomUUID();
    baseVersion = 0;
  }

  const content = buildTextNoteContent({
    id: noteId!,
    title,
    markdown,
    existing: existingDocument,
  });

  const outcome = await upsertNoteForUser(user.id, {
    id: noteId!,
    title,
    kind: "TEXT",
    content,
    baseVersion,
    favorite: existingDocument?.favorite ?? false,
    tags: existingDocument?.tags,
  });

  if (outcome.status === "error") {
    return { error: outcome.message };
  }
  if (outcome.status === "conflict") {
    return {
      error:
        outcome.message +
        " Odśwież stronę, żeby zobaczyć wersję z serwera, i zapisz jeszcze raz jeśli trzeba.",
    };
  }

  revalidatePath("/library");
  revalidatePath(`/note/${noteId}`);

  if (!existingId) {
    redirect(`/note/${noteId}`);
  }

  return {
    success:
      outcome.status === "unchanged"
        ? "Nic się nie zmieniło."
        : `Zapisane (wersja ${outcome.version}).`,
  };
}

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
