import bcrypt from "bcryptjs";
import { z } from "zod";
import { error, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { issueToken } from "@/lib/app-token";
import { quotaState } from "@/lib/quota";

export { OPTIONS } from "@/lib/api";

const form = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  device: z.string().trim().max(120).optional(),
});

export const POST = wrapApi(async (request: Request) => {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return error("bad-request", "Nie udało się odczytać zapytania.", 400);
  }

  const parsed = form.safeParse(data);
  if (!parsed.success) {
    return error("bad-request", "Podaj adres e-mail i hasło.", 400);
  }

  const { email, password, device } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // The same answer for a wrong address and a wrong password. Otherwise it
  // would be possible to check which addresses have accounts.
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return error("bad-credentials", "Zły adres albo złe hasło.", 401);
  }

  if (user.blocked) {
    return error(
      "blocked",
      user.blockReason
        ? `To konto zostało zablokowane: ${user.blockReason}`
        : "To konto zostało zablokowane. Napisz do administratora.",
      403,
    );
  }

  const { token, id } = await issueToken(
    user.id,
    device ?? request.headers.get("x-kajet-device") ?? "Tablet",
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSignInAt: new Date() },
  });

  const storage = await quotaState(user.id);

  return json({
    token,
    tokenId: id,
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
      unlimited: storage.unlimited,
    },
  });
});
