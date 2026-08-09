import { z } from "zod";
import { error, json, wrapApi } from "@/lib/api";
import {
  createLoginChallenge,
  pollLoginChallenge,
} from "@/lib/login-challenge";
import { apiWords } from "@/lib/language";

export { OPTIONS } from "@/lib/api";

const createForm = z.object({
  device: z.string().trim().max(120).optional(),
});

/**
 * Device login for the mobile app.
 *
 * POST - create a one-time challenge and return the URL the app should open.
 * GET  - poll with ?code=… until the user approved in the browser; then issue
 *        an AppToken once (same shape as POST /api/v1/signin).
 */
export const POST = wrapApi(async (request: Request) => {
  let data: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) data = JSON.parse(text);
  } catch {
    return error("bad-request", (await apiWords()).apiBadRequest, 400);
  }

  const parsed = createForm.safeParse(data);
  if (!parsed.success) {
    return error("bad-request", (await apiWords()).apiGiveDeviceName, 400);
  }

  const created = await createLoginChallenge(
    parsed.data.device ?? request.headers.get("x-kajet-device") ?? (await apiWords()).deviceFallback,
  );

  return json(created);
});

export const GET = wrapApi(async (request: Request) => {
  const code = new URL(request.url).searchParams.get("code")?.trim() ?? "";
  if (!code) {
    return error("bad-request", "Brakuje kodu logowania.", 400);
  }

  const result = await pollLoginChallenge(code);

  if (result.status === "pending") {
    return json({ status: "pending" }, 202);
  }
  if (result.status === "denied") {
    return error("denied", (await apiWords()).apiSignInDenied, 403);
  }
  if (result.status === "expired") {
    return error(
      "expired",
      (await apiWords()).apiCodeExpiredOrUsed,
      410,
    );
  }

  return json({
    status: "ready",
    token: result.token,
    tokenId: result.tokenId,
    account: result.account,
    storage: result.storage,
  });
});
