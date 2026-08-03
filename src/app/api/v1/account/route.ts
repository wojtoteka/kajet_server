import { userFromRequest, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { quotaState } from "@/lib/quota";

export { OPTIONS } from "@/lib/api";

export const GET = wrapApi(async (request: Request) => {
  const result = await userFromRequest(request);
  if ("errorResponse" in result) return result.errorResponse;

  const user = result.user;
  const storage = await quotaState(user.id);

  const noteCount = await prisma.note.count({
    where: { ownerId: user.id, deletedAt: null },
  });

  return json({
    account: {
      id: user.id,
      login: user.login,
      email: user.email,
      name: user.name,
      admin: user.role === "ADMIN",
    },
    storage: {
      quota: storage.quota,
      used: storage.used,
      free: storage.free,
      unlimited: storage.unlimited,
      quotaUntil: storage.quotaUntil?.getTime() ?? null,
    },
    noteCount,
  });
});
