import { z } from "zod";
import { error, userFromRequest, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createShare, shareUrl } from "@/lib/sharing";
import { shareMail, send } from "@/lib/mail";
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

  Od panelu udostępnień w aplikacji GET niesie też pełną listę (`shares`) -
  z adresem e-mail, wejściem bez konta i datą ostatniego otwarcia, jak na
  stronie. Stare pole `links` zostaje nietknięte: czytają je aplikacje sprzed
  panelu. POST przyjmuje od tego czasu także adres e-mail (z wysyłką
  wiadomości), przełącznik wejścia bez konta i zero dni jako „bezterminowo".
  Cofnięcie siedzi w share/[shareId]/route.ts.
*/

const form = z.object({
  /** „read" - do czytania, „edit" - do pisania. */
  permission: z.enum(["read", "edit"]).default("read"),
  /** Po ilu dniach odnośnik ma przestać działać. Brak albo zero = bezterminowo. */
  expiresInDays: z.number().int().min(0).max(3650).nullable().optional(),
  /** Udostępnienie imienne - otworzy tylko osoba zalogowana tym adresem. */
  email: z
    .union([z.string().trim().toLowerCase().email(), z.literal(""), z.null()])
    .optional(),
  /** Czy odnośnik otworzy ktoś bez konta. Imienne zawsze wymagają konta. */
  anonymousAllowed: z.boolean().optional(),
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

function base(): string {
  return settings.baseUrl.replace(/\/$/, "");
}

type ShareRow = {
  id: string;
  token: string;
  permission: "READ" | "EDIT";
  email: string | null;
  anonymousAllowed: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  lastUsedAt: Date | null;
};

/** Jeden wpis listy - ten sam kształt w GET i w odpowiedzi POST. */
function entry(share: ShareRow) {
  return {
    id: share.id,
    url: shareUrl(base(), share.token),
    permission: share.permission === "EDIT" ? "edit" : "read",
    email: share.email,
    anonymousAllowed: share.anonymousAllowed,
    expiresAt: share.expiresAt?.getTime() ?? null,
    createdAt: share.createdAt.getTime(),
    lastUsedAt: share.lastUsedAt?.getTime() ?? null,
  };
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

    const shares = await prisma.share.findMany({
      where: { noteId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        permission: true,
        email: true,
        anonymousAllowed: true,
        expiresAt: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    // Stary kształt dla aplikacji sprzed panelu: same żywe odnośniki
    // „dla każdego, kto ma link", bez imiennych.
    const live = shares.filter(
      (share) =>
        !share.email && (!share.expiresAt || share.expiresAt.getTime() > Date.now()),
    );

    return json({
      links: live.map((share) => ({
        url: shareUrl(base(), share.token),
        permission: share.permission === "EDIT" ? "edit" : "read",
        expiresAt: share.expiresAt?.getTime() ?? null,
        createdAt: share.createdAt.getTime(),
      })),
      shares: shares.map(entry),
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
    const email = parsed.data.email || null;
    const anonymousAllowed = email ? false : (parsed.data.anonymousAllowed ?? true);
    const expiresInDays = parsed.data.expiresInDays || null;

    /*
      Odnośnik o tych samych prawach już jest? Oddajemy go zamiast zakładać
      drugi. Inaczej każde stuknięcie w „Udostępnij" zostawiałoby w bazie nowy
      wpis, a odwołanie dostępu wymagałoby kasowania ich po kolei. Dotyczy
      tylko najprostszego przypadku - imienne, terminowe i „tylko z kontem"
      różnią się od siebie i zawsze powstają na nowo.
    */
    if (!email && anonymousAllowed && expiresInDays === null) {
      const existing = await prisma.share.findFirst({
        where: { noteId, email: null, permission, expiresAt: null, anonymousAllowed: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          token: true,
          permission: true,
          email: true,
          anonymousAllowed: true,
          expiresAt: true,
          createdAt: true,
          lastUsedAt: true,
        },
      });
      if (existing) {
        return json({
          ...entry(existing),
          title: note.title,
          fresh: false,
          mailSent: false,
        });
      }
    }

    const { id, token } = await createShare({
      noteId,
      sharedById: result.user.id,
      permission,
      email,
      anonymousAllowed,
      expiresInDays,
    });

    // Imienne udostępnienie niesie wiadomość - tak samo jak na stronie.
    // Nieudana wysyłka nie unieważnia odnośnika: aplikacja dostaje mailSent
    // i sama mówi, że odnośnik trzeba podać inną drogą.
    let mailSent = false;
    if (email) {
      mailSent = await send(
        shareMail(
          email,
          shareUrl(base(), token),
          result.user.name ?? result.user.login,
          note.title || "Bez nazwy",
          permission === "EDIT",
        ),
      );
    }

    return json({
      id,
      url: shareUrl(base(), token),
      permission: parsed.data.permission,
      email,
      anonymousAllowed,
      expiresAt: expiresInDays ? Date.now() + expiresInDays * 86_400_000 : null,
      createdAt: Date.now(),
      lastUsedAt: null,
      title: note.title,
      fresh: true,
      mailSent,
    });
  },
);
