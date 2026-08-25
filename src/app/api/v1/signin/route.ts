import bcrypt from "bcryptjs";
import { z } from "zod";
import { error, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { issueToken } from "@/lib/app-token";
import { quotaState } from "@/lib/quota";
import {
  callerAddress,
  clearFailedSignIns,
  noteFailedSignIn,
  signInAllowed,
} from "@/lib/signin-limits";
import { apiWords } from "@/lib/language";

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
    return error("bad-request", (await apiWords()).apiBadRequest, 400);
  }

  const parsed = form.safeParse(data);
  if (!parsed.success) {
    return error("bad-request", (await apiWords()).apiGiveEmailAndPassword, 400);
  }

  const { email, password, device } = parsed.data;
  const from = callerAddress(request);

  // Pięć nieudanych prób pod rząd zamyka logowanie na kwadrans - żeby nie dało
  // się zgadywać hasła w nieskończoność.
  const gate = await signInAllowed(email, from, await apiWords());
  if (!gate.allowed) {
    return error("too-many-attempts", gate.message, 429, {
      "Retry-After": String(gate.retryInSeconds),
    });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // The same answer for a wrong address and a wrong password. Otherwise it
  // would be possible to check which addresses have accounts.
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    await noteFailedSignIn(email, from);
    return error("bad-credentials", (await apiWords()).apiWrongCredentials, 401);
  }

  if (user.blocked) {
    return error(
      "blocked",
      user.blockReason
        ? `To konto zostało zablokowane: ${user.blockReason}`
        : (await apiWords()).apiAccountBlocked,
      403,
    );
  }

  await clearFailedSignIns(email, from);

  const { token, id } = await issueToken(
    user.id,
    device ?? request.headers.get("x-kajet-device") ?? (await apiWords()).deviceFallback,
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
