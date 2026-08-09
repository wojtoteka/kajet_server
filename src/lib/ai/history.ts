/*
  Pamięć rozmowy z asystentem.

  Bez niej „a teraz skróć to jeszcze bardziej" nie ma do czego się odnieść -
  model dostaje samą notatkę i polecenie, więc „jeszcze bardziej" nie znaczy
  nic. Z nią widzi, o co proszono przed chwilą.

  Trzy rzeczy warto wiedzieć:

  GDZIE. W bazie, w tabeli ai_turns, przy parze (konto, notatka). Nie w pamięci
  procesu - ta ginie przy każdym wdrożeniu, a rozmowa ma przeżyć zamknięcie
  aplikacji. Nie po stronie Google - do modelu jedzie wszystko za każdym razem
  od nowa, z `store: false`, więc u nich nic nie zostaje.

  JAK DŁUGO. Doba od ostatniego słowa i najwyżej kilka ostatnich wymian. Pełna
  treść notatki leci przy KAŻDYM żądaniu, więc historia dokłada się do rachunku
  bez końca, a po dobie i tak nikt nie pamięta, o co prosił. Wartości siedzą
  w ustawieniach (AI_HISTORY_TURNS, AI_HISTORY_HOURS).

  CO. Polecenie człowieka i zdanie, którym asystent odpowiedział. Treści notatki
  tu nie ma - ta i tak leży w tabeli notatek, a duplikowanie jej w historii
  znaczyłoby tylko tyle, że skasowanie notatki zostawia po niej kopię.
*/

import { prisma } from "@/lib/prisma";
import { settings } from "@/lib/settings";

export type AiTurnRecord = { request: string; reply: string };

function expiryDate(): Date {
  return new Date(Date.now() - settings.ai.historyHours * 3_600_000);
}

/**
 * Ostatnie wymiany przy tej notatce, od najstarszej - w takiej kolejności
 * jadą do modelu. Wpisy starsze niż termin ważności nie są brane pod uwagę,
 * choćby jeszcze leżały w bazie: sprzątanie chodzi rzadziej niż rozmowy.
 */
export async function recentTurns(
  userId: string,
  noteId: string,
): Promise<AiTurnRecord[]> {
  const rows = await prisma.aiTurn.findMany({
    where: { userId, noteId, createdAt: { gte: expiryDate() } },
    orderBy: { id: "desc" },
    take: settings.ai.historyTurns,
    select: { request: true, reply: true },
  });
  return rows.reverse();
}

/**
 * Dopisuje wymianę. Tylko wstawianie, nigdy nadpisywanie - obcięcie do kilku
 * ostatnich robi się przy czytaniu, a nadmiar sprząta {@link sweepOldTurns}.
 */
export async function rememberTurn(
  userId: string,
  noteId: string,
  request: string,
  reply: string,
): Promise<void> {
  await prisma.aiTurn.create({
    data: {
      userId,
      noteId,
      // Zapisujemy tyle, ile ma sens pokazać z powrotem. Ktoś, kto wklei
      // do polecenia pół książki, nie ma prawa rozdąć nam tabeli historii.
      request: request.slice(0, 2_000),
      reply: reply.slice(0, 2_000),
    },
  });
}

/** Wyczyszczenie rozmowy przy jednej notatce, na życzenie człowieka. */
export async function forgetTurns(userId: string, noteId: string): Promise<number> {
  const gone = await prisma.aiTurn.deleteMany({ where: { userId, noteId } });
  return gone.count;
}

/**
 * Sprzątanie tego, co się przeterminowało. Wołane po zapisie wymiany, więc
 * chodzi mniej więcej tak często, jak ktoś korzysta z asystenta - dla
 * kilkunastu kont to zupełnie wystarcza i nie potrzeba na to osobnego zadania.
 */
export async function sweepOldTurns(): Promise<void> {
  await prisma.aiTurn.deleteMany({ where: { createdAt: { lt: expiryDate() } } });
}
