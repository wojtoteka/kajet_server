/*
  POST /api/v1/notes/[id]/ai-edit - poproszenie asystenta o zmianę notatki.

  Aplikacja wysyła TYLKO identyfikator notatki i polecenie. Treści nie wysyła:
  serwer ją ma, a te same bajty w obie strony po to, żeby zaraz odesłać je do
  Google, byłyby marnowaniem łącza na tablecie.

  Cała robota siedzi w lib/ai/run.ts, wspólnie z akcją panelu WWW. Tutaj
  zostaje samo rozpoznanie, kto pyta (token urządzenia), i przełożenie wyniku
  na HTTP.
*/

import { z } from "zod";
import { error, json, userFromRequest, wrapApi } from "@/lib/api";
import { apiWords } from "@/lib/language";
import { aiRefusal } from "@/lib/ai/access";
import { runAiEdit } from "@/lib/ai/run";

export { OPTIONS } from "@/lib/api";

const body = z.object({
  instruction: z.string().trim().min(1).max(2_000),
  /**
   * Wersja, którą ma u siebie urządzenie. Gdy przyjdzie i nie zgadza się
   * z serwerem, odmawiamy od razu - bez sensu jest zmieniać treść, której
   * człowiek jeszcze nie widział.
   *
   * Zero znaczy „nie sprawdzaj", tak samo jak w planNoteUpsert: aplikacja
   * odpala przed prośbą zwykłą synchronizację i po niej wie, że ma to samo co
   * serwer, ale nie zna numeru, który przy okazji urósł. Nieobecne pole znaczy
   * to samo - starsze wydania aplikacji nie przyślą go wcale.
   */
  baseVersion: z.number().int().min(0).optional(),
});

export const POST = wrapApi(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const result = await userFromRequest(request);
    if ("errorResponse" in result) return result.errorResponse;

    const words = await apiWords();
    const { id: noteId } = await params;

    let data: unknown;
    try {
      data = await request.json();
    } catch {
      return error("bad-request", words.apiBadRequest, 400);
    }

    const parsed = body.safeParse(data);
    if (!parsed.success) return error("bad-request", words.apiAiNoInstruction, 400);

    const outcome = await runAiEdit({
      user: result.user,
      noteId,
      instruction: parsed.data.instruction,
      baseVersion: parsed.data.baseVersion,
      words,
    });

    // Konto bez uprawnienia dostaje odpowiedź co do znaku taką samą jak na
    // nieistniejący adres - odmowa nie ma prawa zdradzić, że asystent istnieje.
    if (outcome.status === "ukryte") return aiRefusal({ ok: false, hidden: true });

    if (outcome.status === "blad") {
      return error(outcome.code, outcome.message, outcome.httpStatus);
    }

    return json(outcome);
  },
);
