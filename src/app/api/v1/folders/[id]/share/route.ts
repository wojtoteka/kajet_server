import { z } from "zod";
import { error, json, userFromRequest, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createShare, shareUrl } from "@/lib/sharing";
import { send, shareMail } from "@/lib/mail";
import { settings } from "@/lib/settings";
import { apiWords } from "@/lib/language";

export { OPTIONS } from "@/lib/api";

/*
  Udostępnienie całego folderu - dla aplikacji. Ten sam kształt co przy
  notatce (notes/[id]/share): GET oddaje listę, POST zakłada nowe (z adresem
  e-mail i wiadomością, z wejściem bez konta albo bez), cofnięcie siedzi
  w share/[shareId]. Odbiorca widzi folder z podfolderami i wszystkim, co
  w nim powstanie później - także notatki dopisane po udostępnieniu.
*/

const form = z.object({
  permission: z.enum(["read", "edit"]).default("read"),
  expiresInDays: z.number().int().min(0).max(3650).nullable().optional(),
  email: z
    .union([z.string().trim().toLowerCase().email(), z.literal(""), z.null()])
    .optional(),
  anonymousAllowed: z.boolean().optional(),
});

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
  acceptedAt?: Date | null;
};

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
    acceptedAt: share.acceptedAt?.getTime() ?? null,
  };
}

async function ownedFolder(userId: string, folderId: string) {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { id: true, ownerId: true, name: true },
  });
  if (!folder) return null;
  if (folder.ownerId !== userId) return "not-yours" as const;
  return folder;
}

export const GET = wrapApi(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const result = await userFromRequest(request);
    if ("errorResponse" in result) return result.errorResponse;
    const { id } = await params;
    const words = await apiWords();

    const folder = await ownedFolder(result.user.id, id);
    if (folder === null) return error("not-found", words.apiLinkDead, 404);
    if (folder === "not-yours") return error("not-yours", words.apiNoteNotYours, 403);

    const shares = await prisma.share.findMany({
      where: { folderId: id },
      orderBy: { createdAt: "desc" },
    });
    return json({ shares: shares.map(entry) });
  },
);

export const POST = wrapApi(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const result = await userFromRequest(request);
    if ("errorResponse" in result) return result.errorResponse;
    const { id } = await params;
    const words = await apiWords();

    let data: unknown = {};
    try {
      const text = await request.text();
      if (text.trim()) data = JSON.parse(text);
    } catch {
      return error("bad-request", words.apiBadRequest, 400);
    }
    const parsed = form.safeParse(data);
    if (!parsed.success) return error("bad-request", words.apiUnknownShape, 400);

    const folder = await ownedFolder(result.user.id, id);
    if (folder === null) return error("not-found", words.apiLinkDead, 404);
    if (folder === "not-yours") return error("not-yours", words.apiNoteNotYours, 403);

    const permission = parsed.data.permission === "edit" ? "EDIT" : "READ";
    const email = parsed.data.email || null;
    const anonymousAllowed = email ? false : (parsed.data.anonymousAllowed ?? true);
    const expiresInDays = parsed.data.expiresInDays || null;

    // Ten sam zwykły odnośnik już jest - oddajemy go zamiast mnożyć wpisy.
    if (!email && anonymousAllowed && expiresInDays === null) {
      const existing = await prisma.share.findFirst({
        where: { folderId: id, email: null, permission, expiresAt: null, anonymousAllowed: true },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        return json({ ...entry(existing), title: folder.name, fresh: false, mailSent: false });
      }
    }

    const { token } = await createShare({
      folderId: id,
      sharedById: result.user.id,
      permission,
      email,
      anonymousAllowed,
      expiresInDays,
    });
    const created = await prisma.share.findUniqueOrThrow({ where: { token } });

    let mailSent = false;
    if (email) {
      mailSent = await send(
        shareMail(
          email,
          shareUrl(base(), token),
          result.user.name ?? result.user.login,
          folder.name,
          permission === "EDIT",
          "folder",
        ),
      );
    }

    return json({ ...entry(created), title: folder.name, fresh: true, mailSent });
  },
);
