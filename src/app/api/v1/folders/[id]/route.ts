import { error, userFromRequest, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { apiWords } from "@/lib/language";

export { OPTIONS } from "@/lib/api";

/**
 * Removes a folder (the device threw it into its bin). Child folders go with
 * it (cascade); notes only lose their folder (folderId becomes null) - their
 * deletion travels separately as per-note tombstones.
 */
export const DELETE = wrapApi(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const result = await userFromRequest(request);
    if ("errorResponse" in result) return result.errorResponse;
    const { id: folderId } = await params;

    const existing = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { id: true, ownerId: true },
    });

    // Already gone counts as done - deletions are retried.
    if (!existing) return json({ status: "ok" });

    if (existing.ownerId !== result.user.id) {
      return error("not-yours", (await apiWords()).apiFolderNotYours, 403);
    }

    await prisma.folder.delete({ where: { id: folderId } });
    return json({ status: "ok" });
  },
);
