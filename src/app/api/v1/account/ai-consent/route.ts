/*
  POST /api/v1/account/ai-consent - zgoda na wysyłanie treści notatek do Google.

  Zgoda siedzi PRZY KONCIE, nie na urządzeniu. Zapisana lokalnie zniknęłaby po
  przeinstalowaniu aplikacji albo po zalogowaniu się na drugim tablecie, a
  wtedy trzeba by pytać o nią w kółko - albo, co gorsza, nie pytać wcale.

  Wycofanie zgody kasuje też rozmowy z asystentem. Nie ma w nich treści
  notatek, ale są polecenia, które człowiek pisał - a skoro wycofuje zgodę na
  całą funkcję, zostawianie po niej zapisków byłoby dziwne.
*/

import { z } from "zod";
import { error, json, userFromRequest, wrapApi } from "@/lib/api";
import { apiWords } from "@/lib/language";
import { aiRefusal, aiVisibleFor } from "@/lib/ai/access";
import { setAiConsent } from "@/lib/ai/consent";

export { OPTIONS } from "@/lib/api";

const body = z.object({ consented: z.boolean() });

export const POST = wrapApi(async (request: Request) => {
  const result = await userFromRequest(request);
  if ("errorResponse" in result) return result.errorResponse;

  // Bramka na samo uprawnienie: o zgodę pyta się tych, którzy funkcję mają.
  // Konto bez uprawnienia nie ma się na co zgadzać i nie ma się dowiedzieć,
  // że jest czego odmawiać.
  if (!aiVisibleFor(result.user)) {
    return aiRefusal({ ok: false, hidden: true });
  }

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return error("bad-request", (await apiWords()).apiBadRequest, 400);
  }

  const parsed = body.safeParse(data);
  if (!parsed.success) {
    return error("bad-request", (await apiWords()).apiBadRequest, 400);
  }

  await setAiConsent(result.user.id, parsed.data.consented);

  return json({ status: "ok", consented: parsed.data.consented });
});
