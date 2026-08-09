import { z } from "zod";
import { error, userFromRequest, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { apiWords } from "@/lib/language";

export { OPTIONS } from "@/lib/api";

// --- Folder sync ---
//
// The tablet mirrors its directory tree here. Folder ids come from the
// device (folder.json carries a UUID), so the same folder keeps one identity
// on every device. GET returns the whole tree (accounts have few folders),
// PUT upserts a single folder, DELETE /api/v1/folders/[id] removes one.

export const GET = wrapApi(async (request: Request) => {
  const result = await userFromRequest(request);
  if ("errorResponse" in result) return result.errorResponse;

  const folders = await prisma.folder.findMany({
    where: { ownerId: result.user.id },
    select: {
      id: true,
      parentId: true,
      name: true,
      colorId: true,
      iconId: true,
      updatedAt: true,
    },
  });

  return json({
    folders: folders.map((folder) => ({
      ...folder,
      updatedAt: folder.updatedAt.getTime(),
    })),
  });
});

const outgoingFolderSchema = z.object({
  id: z.string().min(1).max(64),
  // Absent or null both mean: the folder sits at the root of the library.
  parentId: z.string().max(64).nullable().optional(),
  name: z.string().min(1).max(300),
  colorId: z.string().max(64).optional(),
  iconId: z.string().max(64).optional(),
});

export const PUT = wrapApi(async (request: Request) => {
  const result = await userFromRequest(request);
  if ("errorResponse" in result) return result.errorResponse;

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return error("bad-request", (await apiWords()).apiBadRequest, 400);
  }

  const parsed = outgoingFolderSchema.safeParse(data);
  if (!parsed.success) {
    return error("bad-request", (await apiWords()).apiFolderUnknownShape, 400);
  }
  const folder = parsed.data;

  const existing = await prisma.folder.findUnique({
    where: { id: folder.id },
    select: { id: true, ownerId: true },
  });
  if (existing && existing.ownerId !== result.user.id) {
    return error("not-yours", (await apiWords()).apiFolderNotYours, 403);
  }

  // A parent that does not exist here (yet) or belongs to somebody else must
  // not break the write - the folder lands at the root and a later sync can
  // move it once the parent has arrived.
  let parentId: string | null = folder.parentId ?? null;
  if (parentId === folder.id) parentId = null;
  if (parentId) {
    const parent = await prisma.folder.findUnique({
      where: { id: parentId },
      select: { id: true, ownerId: true },
    });
    if (!parent || parent.ownerId !== result.user.id) parentId = null;
  }

  // No cycles: a folder must not end up inside its own subtree. We walk up
  // the would-be parent chain; hitting the folder itself sends it to the root.
  let ancestor = parentId;
  for (let depth = 0; ancestor && depth < 100; depth += 1) {
    if (ancestor === folder.id) {
      parentId = null;
      break;
    }
    const above: { parentId: string | null } | null = await prisma.folder.findUnique({
      where: { id: ancestor },
      select: { parentId: true },
    });
    ancestor = above?.parentId ?? null;
  }

  const saved = await prisma.folder.upsert({
    where: { id: folder.id },
    create: {
      id: folder.id,
      ownerId: result.user.id,
      parentId,
      name: folder.name,
      colorId: folder.colorId ?? "grafit",
      iconId: folder.iconId ?? "folder",
    },
    update: {
      parentId,
      name: folder.name,
      colorId: folder.colorId ?? "grafit",
      iconId: folder.iconId ?? "folder",
    },
    select: { updatedAt: true },
  });

  return json({ status: "ok", updatedAt: saved.updatedAt.getTime() });
});
