import { userFromRequest, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { quotaState } from "@/lib/quota";
import { aiVisibleFor } from "@/lib/ai/access";

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
    /*
      Asystent. Gałęzi NIE MA WCALE, gdy konto nie ma uprawnienia - nie ma jej
      też jako `false`. Aplikacja pokazuje pole „poproś AI o zmianę" tylko
      wtedy, gdy tę gałąź dostała, więc jej brak i tak wystarcza, a odpowiedź
      przy okazji nie mówi, że coś takiego w Kajecie w ogóle jest.
    */
    ...(aiVisibleFor(user)
      ? { ai: { consented: user.aiConsentAt != null } }
      : {}),
  });
});
