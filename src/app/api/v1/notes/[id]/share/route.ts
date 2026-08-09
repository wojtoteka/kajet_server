import { z } from "zod";
import { error, userFromRequest, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createShare, shareUrl } from "@/lib/sharing";
import { settings } from "@/lib/settings";
import { apiWords } from "@/lib/language";

export { OPTIONS } from "@/lib/api";

/*
  Odnośnik do notatki - dla aplikacji.

  Notatka zsynchronizowana z chmurą ma na serwerze swoją tożsamość, więc da się
  ją komuś podać bez otwierania strony: aplikacja prosi tu o odnośnik i podaje
  go dalej systemowym „Udostępnij". Bez tego jedyną drogą było wejście na
  stronę, znalezienie notatki i kliknięcie w niej „Udostępnij" - a to na
  tablecie z rysikiem w ręku jest wyprawa.

  GET oddaje odnośnik, który już istnieje (jeśli jest taki sam co do praw),
  POST zakłada nowy. Dzięki temu dwa udostępnienia tej samej notatki nie mnożą
  odnośników bez potrzeby.
*/

const form = z.object({
  /** „read" - do czytania, „edit" - do pisania. */
  permission: z.enum(["read", "edit"]).default("read"),
  /** Po ilu dniach odnośnik ma przestać działać. Brak = bezterminowo. */
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
});

async function ownedNote(userId: string, noteId: string) {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, ownerId: true, deletedAt: true, title: true },
  });
  if (!note || note.deletedAt) return null;
  if (note.ownerId !== userId) return "not-yours" as const;
  return note;
}

export const GET = wrapApi(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const result = await userFromRequest(request);
    if ("errorResponse" in result) return result.errorResponse;
    const { id: noteId } = await params;

    const note = await ownedNote(result.user.id, noteId);
    if (note === null) return error("not-found", "Nie ma takiej notatki.", 404);
    if (note === "not-yours") {
      return error("not-yours", (await apiWords()).apiNoteNotYours, 403);
    }

    // Same odnośniki „dla każdego, kto ma link" - osobiste udostępnienia po
    // adresie e-mail zakłada się na stronie i aplikacja ich nie rusza.
    const shares = await prisma.share.findMany({
      where: { noteId, email: null },
      orderBy: { createdAt: "desc" },
      select: { token: true, permission: true, expiresAt: true, createdAt: true },
    });

    const live = shares.filter(
      (share) => !share.expiresAt || share.expiresAt.getTime() > Date.now(),
    );

    return json({
      links: live.map((share) => ({
        url: shareUrl(settings.baseUrl.replace(/\/$/, ""), share.token),
        permission: share.permission === "EDIT" ? "edit" : "read",
        expiresAt: share.expiresAt?.getTime() ?? null,
        createdAt: share.createdAt.getTime(),
      })),
    });
  },
);

export const POST = wrapApi(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const result = await userFromRequest(request);
    if ("errorResponse" in result) return result.errorResponse;
    const { id: noteId } = await params;

    // Puste ciało znaczy „zwykły odnośnik do czytania" - aplikacja nie musi
    // niczego wysyłać, żeby dostać najprostszy przypadek.
    let data: unknown = {};
    try {
      const text = await request.text();
      if (text.trim()) data = JSON.parse(text);
    } catch {
      return error("bad-request", (await apiWords()).apiBadRequest, 400);
    }

    const parsed = form.safeParse(data);
    if (!parsed.success) {
      return error("bad-request", (await apiWords()).apiUnknownShape, 400);
    }

    const note = await ownedNote(result.user.id, noteId);
    if (note === null) {
      return error(
        "not-found",
        (await apiWords()).apiNoteNotOnServer,
        404,
      );
    }
    if (note === "not-yours") {
      return error("not-yours", (await apiWords()).apiNoteNotYours, 403);
    }

    const permission = parsed.data.permission === "edit" ? "EDIT" : "READ";
    const expiresInDays = parsed.data.expiresInDays ?? null;

    /*
      Odnośnik o tych samych prawach już jest? Oddajemy go zamiast zakładać
      drugi. Inaczej każde stuknięcie w „Udostępnij" zostawiałoby w bazie nowy
      wpis, a odwołanie dostępu wymagałoby kasowania ich po kolei.
    */
    if (expiresInDays === null) {
      const existing = await prisma.share.findFirst({
        where: { noteId, email: null, permission, expiresAt: null },
        orderBy: { createdAt: "desc" },
        select: { token: true },
      });
      if (existing) {
        return json({
          url: shareUrl(settings.baseUrl.replace(/\/$/, ""), existing.token),
          permission: parsed.data.permission,
          expiresAt: null,
          title: note.title,
          fresh: false,
        });
      }
    }

    const token = await createShare({
      noteId,
      sharedById: result.user.id,
      permission,
      anonymousAllowed: true,
      expiresInDays,
    });

    return json({
      url: shareUrl(settings.baseUrl.replace(/\/$/, ""), token),
      permission: parsed.data.permission,
      expiresAt: expiresInDays ? Date.now() + expiresInDays * 86_400_000 : null,
      title: note.title,
      fresh: true,
    });
  },
);
