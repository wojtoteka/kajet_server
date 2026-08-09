import { Prisma } from "@prisma/client";
import { userFromRequest, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export { OPTIONS } from "@/lib/api";

/*
  Spis notatek skasowanych na zawsze.

  Zwykłe pobieranie zmian (GET /api/v1/notes) opiera się na tym, co w bazie
  stoi. Notatka wyrzucona do kosza jeszcze tam jest i jedzie z polem
  `deletedAt`, ale skasowana na zawsze nie zostawia po sobie wiersza - i tędy
  urządzenie nigdy się o niej nie dowie. Ten punkt oddaje same identyfikatory
  z tabeli nagrobków, po tym samym kursorze co notatki.

  Nowa trasa, dokładana obok istniejących. Starszy serwer odpowiada na nią 404
  i aplikacja po prostu pomija ten krok, wracając do porównywania pełnego spisu
  identyfikatorów.
*/

/**
 * Ile nagrobków na stronę. Więcej niż przy notatkach, bo wiersz to sam
 * identyfikator i data - strona waży kilkadziesiąt kilobajtów przy pięciuset.
 */
const PAGE_SIZE = 500;

// Kursor to para (deletedAt, noteId), tak samo jak przy notatkach:
//   since   - milisekundy od epoki; brak albo 0 znaczy „od początku"
//   afterId - identyfikator do pominięcia, gdy kilka wpisów ma tę samą datę
// W odpowiedzi:
//   upTo    - data ostatniego wpisu na tej stronie (ms)
//   upToId  - jego identyfikator (null przy pustej stronie)
//   hasMore - czy warto pytać dalej

export const GET = wrapApi(async (request: Request) => {
  const result = await userFromRequest(request);
  if ("errorResponse" in result) return result.errorResponse;

  const url = new URL(request.url);
  const sinceRaw = url.searchParams.get("since");
  const afterId = url.searchParams.get("afterId");

  const sinceMs = sinceRaw != null && sinceRaw !== "" ? Number(sinceRaw) : NaN;
  const sinceDate = Number.isFinite(sinceMs) && sinceMs > 0 ? new Date(sinceMs) : null;

  const cursorFilter: Prisma.DeletedNoteWhereInput = sinceDate
    ? afterId
      ? {
          OR: [
            { deletedAt: { gt: sinceDate } },
            { deletedAt: sinceDate, noteId: { gt: afterId } },
          ],
        }
      : { deletedAt: { gt: sinceDate } }
    : {};

  const page = await prisma.deletedNote.findMany({
    where: { ownerId: result.user.id, ...cursorFilter },
    orderBy: [{ deletedAt: "asc" }, { noteId: "asc" }],
    take: PAGE_SIZE,
    select: { noteId: true, deletedAt: true },
  });

  const last = page.at(-1);

  return json({
    ids: page.map((row) => row.noteId),
    // Znacznik bierzemy z ostatniego wpisu, nie z zegara serwera - inaczej
    // kasowanie trwające w chwili odpowiedzi wypadłoby poza zakres i przepadło.
    upTo: last?.deletedAt.getTime() ?? (sinceDate ? sinceDate.getTime() : 0),
    upToId: last?.noteId ?? null,
    hasMore: page.length === PAGE_SIZE,
  });
});
