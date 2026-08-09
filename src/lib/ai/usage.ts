/*
  Ślad po wywołaniu modelu - do rozliczeń i do limitów.

  Czego tu NIE MA i nie będzie: treści notatki, polecenia użytkownika,
  odpowiedzi modelu ani identyfikatora notatki. Wiersz mówi tylko tyle: kto,
  kiedy, przy jakim typie notatki, jakim modelem, ile tokenów i czy się udało.
  Tyle wystarcza, żeby złożyć rachunek i wypatrzeć nadużycie, a rozmowa - ta,
  którą człowiek może wyczyścić jednym przyciskiem - siedzi osobno w ai_turns.

  Zapisujemy TAKŻE nieudane wywołania. Za tokeny wejściowe płaci się również
  wtedy, gdy odpowiedź do niczego się nie nadała, a model wywracający się
  w kółko musi wliczać się w limit.
*/

import { prisma } from "@/lib/prisma";
import { settings } from "@/lib/settings";
import type { TokenUse } from "./gemini";
import type { AiKind } from "./tools";

export async function recordAiCall(input: {
  userId: string;
  kind: AiKind;
  usage: TokenUse;
  tookMs: number;
  /** Puste, gdy się udało. Krótkie słowo, nie zdanie. */
  failure?: string;
}): Promise<void> {
  try {
    await prisma.aiCall.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        model: settings.ai.model,
        inputTokens: input.usage.input,
        outputTokens: input.usage.output,
        tookMs: input.tookMs,
        failure: input.failure ?? null,
      },
    });
  } catch (problem) {
    // Niepowodzenie zapisu do rozliczeń nie ma prawa przewrócić zmiany, którą
    // człowiek właśnie dostał. Zostaje w logu serwera.
    console.error("[ai] nie udało się zapisać wywołania do rozliczeń", problem);
  }
}
