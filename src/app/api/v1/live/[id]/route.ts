import { randomBytes } from "node:crypto";
import { error, json, wrapApi } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { apiWords } from "@/lib/language";
import { upsertCodeNoteForUser, upsertNoteForUser, type UpsertNoteResult } from "@/lib/note-write";
import { applyDelta, isDelta, isPlainObject, type Json } from "@/lib/live/merge";
import { join, people, personColor, type LiveEvent } from "@/lib/live/bus";
import {
  changesSince,
  cleanClientId,
  contentUnchangedSince,
  type StoredChange,
} from "@/lib/live/changes";
import { noteRights, viewerFromRequest } from "@/lib/live/access";

export { OPTIONS } from "@/lib/api";

// Strumień żyje tak długo, jak otwarta notatka - nic tu nie da się zbuforować.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/*
  Edycja na żywo jednej notatki.

  GET    - strumień zdarzeń (Server-Sent Events): najpierw to, czego klient
           nie widział od wersji `since`, potem każda nowa zmiana, lista osób
           w notatce i sygnał „notatki już nie ma". `?state=1` oddaje zamiast
           tego samą treść z wersją (do pierwszego wczytania).
  POST   - delta od klienta: { base, d, c }. Przyjmowana tylko wtedy, gdy
           treść na serwerze jest wciąż tą z wersji `base`. W przeciwnym razie
           odpowiedź „stale" - klient dociąga zmianę ze strumienia, scala ją
           u siebie (src/lib/live/merge.ts) i wysyła jeszcze raz.

  Dlaczego strumień, a nie WebSocket: idzie zwykłym HTTP przez nginx
  i Cloudflare bez żadnych zmian w ich ustawieniach, a `next start` obsługuje
  go bez osobnego serwera. Żeby nic po drodze go nie trzymało w buforze:
  X-Accel-Buffering: no (nginx), Cache-Control: no-transform (Cloudflare
  i kompresja), a co 20 sekund pusty komentarz - Cloudflare zrywa połączenie
  po 100 sekundach ciszy, nginx domyślnie po 60.

  Gdy nikt inny notatki nie ma otwartej, przez łącze idzie tylko ten
  komentarz, kilkanaście bajtów co 20 sekund. Zmiana kreski albo słowa to
  delta rzędu setek bajtów, a nie cała notatka.

  Wejście: właściciel, udostępnienie przyjęte przez konto albo odnośnik `t`.
  Prawa sprawdzamy przy otwarciu i co minutę - cofnięte udostępnienie
  zamyka strumień.
*/

const HEARTBEAT_MS = 20_000;
/** Co ile zaglądamy do bazy - na wypadek zapisu z innego procesu serwera. */
const POLL_MS = 5_000;
const RECHECK_MS = 60_000;
/** Największa delta. Zwykle to setki bajtów; pierwsza wysyłka bywa całą notatką. */
const MAX_BODY_BYTES = 16 * 1024 * 1024;

type Params = { params: Promise<{ id: string }> };

async function denied(reason: "invalid" | "expired" | "blocked" | "missing"): Promise<Response> {
  const words = await apiWords();
  const messages = {
    missing: words.apiNotSignedIn,
    invalid: words.apiTokenDead,
    expired: words.apiTokenExpired,
    blocked: words.apiAccountBlocked,
  };
  return error(reason, messages[reason], reason === "blocked" ? 403 : 401);
}

export const GET = wrapApi(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("t");

  const who = await viewerFromRequest(request);
  if (!who.ok) return denied(who.reason);
  const viewer = who.viewer;

  const rights = await noteRights(id, viewer, token);
  if (!rights) return error("no-access", (await apiWords()).apiLinkDead, 404);

  if (url.searchParams.get("state") === "1") {
    const row = await prisma.note.findUnique({
      where: { id },
      select: { content: true, version: true, kind: true, title: true },
    });
    if (!row) return error("no-access", (await apiWords()).apiLinkDead, 404);
    return json({
      id,
      version: row.version,
      content: row.content,
      kind: row.kind,
      title: row.title,
      canEdit: rights.canEdit,
      isOwner: rights.isOwner,
      people: people(id),
    });
  }

  const client = cleanClientId(url.searchParams.get("c")) || randomBytes(9).toString("base64url");
  const since = Math.max(0, Math.floor(Number(url.searchParams.get("since") ?? "0") || 0));
  const encoder = new TextEncoder();
  let finish = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      let closed = false;
      let ready = false;
      let delivered = since;
      let polling = false;
      const waiting: LiveEvent[] = [];
      const timers: ReturnType<typeof setInterval>[] = [];
      let leave = () => {};

      const stop = () => {
        if (closed) return;
        closed = true;
        leave();
        for (const timer of timers) clearInterval(timer);
        try {
          controller.close();
        } catch {
          // Już zamknięty przez drugą stronę.
        }
      };
      finish = stop;

      const write = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          stop();
        }
      };
      const send = (event: string, data: unknown) =>
        write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const deliverChange = (change: StoredChange) => {
        if (change.v <= delivered) return;
        delivered = change.v;
        send("change", change);
      };

      const deliver = (event: LiveEvent) => {
        switch (event.type) {
          case "change":
            deliverChange({ v: event.v, by: event.by, name: event.name, d: event.d });
            break;
          case "reset":
            if (event.v < delivered) return;
            delivered = event.v;
            send("reset", { v: event.v, content: event.content });
            break;
          case "people":
            send("people", event.people);
            break;
          case "gone":
            send("gone", {});
            stop();
            break;
        }
      };

      request.signal.addEventListener("abort", stop);
      leave = join(
        id,
        { client, name: viewer.name, app: viewer.app, color: personColor(viewer.name) },
        (event) => (ready ? deliver(event) : waiting.push(event)),
      );

      try {
        const row = await prisma.note.findUnique({
          where: { id },
          select: { version: true, content: true, deletedAt: true },
        });
        if (!row || row.deletedAt) {
          send("gone", {});
          stop();
          return;
        }
        if (since < row.version) {
          const changes = await changesSince(id, since);
          if (changes) {
            for (const change of changes) deliverChange(change);
          } else {
            send("reset", { v: row.version, content: row.content });
          }
        }
        // Wersja mogła urosnąć bez zmiany treści (gwiazdka, folder) - klient
        // ma i tak znać tę najnowszą.
        delivered = Math.max(delivered, row.version);
        send("hello", {
          version: delivered,
          you: client,
          canEdit: rights.canEdit,
          people: people(id),
        });
      } catch (problem) {
        console.error("[live] otwarcie strumienia", problem);
        stop();
        return;
      }

      ready = true;
      for (const event of waiting.splice(0)) deliver(event);

      timers.push(setInterval(() => write(": ping\n\n"), HEARTBEAT_MS));

      timers.push(
        setInterval(async () => {
          if (closed || polling) return;
          polling = true;
          try {
            const rows = await prisma.liveChange.findMany({
              where: { noteId: id, version: { gt: delivered } },
              orderBy: [{ version: "asc" }, { id: "asc" }],
              take: 50,
            });
            for (const row of rows) {
              deliverChange({
                v: row.version,
                by: row.clientId,
                name: row.authorName,
                d: JSON.parse(row.operation),
              });
            }
          } catch {
            // Chwilowy kłopot z bazą - następna próba za kilka sekund.
          } finally {
            polling = false;
          }
        }, POLL_MS),
      );

      timers.push(
        setInterval(async () => {
          if (closed) return;
          try {
            const still = await noteRights(id, viewer, token);
            if (!still) {
              send("gone", {});
              stop();
            }
          } catch {
            // Sprawdzimy za minutę.
          }
        }, RECHECK_MS),
      );
    },
    cancel: () => finish(),
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
});

function tagsOf(value: unknown, fallback: string): string[] {
  if (Array.isArray(value) && value.every((tag) => typeof tag === "string")) return value;
  return fallback.split("|").filter(Boolean);
}

export const POST = wrapApi(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const url = new URL(request.url);
  const words = await apiWords();

  const who = await viewerFromRequest(request);
  if (!who.ok) return denied(who.reason);
  const viewer = who.viewer;

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    return error("too-large", words.apiBadRequest, 413);
  }
  let body: { base?: unknown; d?: unknown; c?: unknown; t?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return error("bad-request", words.apiBadRequest, 400);
  }
  if (!Number.isInteger(body.base) || !isDelta(body.d)) {
    return error("bad-request", words.apiUnknownShape, 400);
  }
  const base = body.base as number;
  const delta = body.d;
  const token = url.searchParams.get("t") ?? (typeof body.t === "string" ? body.t : null);

  const rights = await noteRights(id, viewer, token);
  if (!rights) return error("no-access", words.apiLinkDead, 404);
  if (!rights.canEdit) return error("read-only", words.apiShareReadOnly, 403);

  const row = await prisma.note.findUnique({
    where: { id },
    select: { content: true, version: true, deletedAt: true },
  });
  if (!row || row.deletedAt) return json({ status: "gone", version: 0 }, 410);

  if (!(await contentUnchangedSince(id, base, row.version))) {
    return json({ status: "stale", version: row.version });
  }

  let document: Json;
  try {
    document = JSON.parse(row.content) as Json;
  } catch {
    document = {};
  }
  const next = applyDelta(document, delta);
  if (!isPlainObject(next)) return error("bad-request", words.apiUnknownShape, 400);
  // Delta nie przestawia notatki pod inny identyfikator.
  if (isPlainObject(document) && typeof document.id === "string") next.id = document.id;

  const note = rights.note;
  const content = JSON.stringify(next);
  const title = typeof next.title === "string" ? next.title : note.title;
  /*
    Gwiazdkę i etykiety zmienia tylko właściciel - to jego porządek
    w bibliotece - i tylko wtedy, gdy delta naprawdę je rusza. Treść notatki
    niesie swoją kopię gwiazdki, która bywa starsza niż ta w bazie (gwiazdka
    przełączona na stronie nie zmienia treści). Wzięta bez pytania cofałaby
    tamto przełączenie przy każdym słowie dopisanym na tablecie.
  */
  const touched = (field: string) =>
    "o" in delta && Object.prototype.hasOwnProperty.call(delta.o, field);
  const favorite =
    rights.isOwner && touched("favorite") && typeof next.favorite === "boolean"
      ? next.favorite
      : note.favorite;
  const tags =
    rights.isOwner && touched("tags") ? tagsOf(next.tags, note.tags) : tagsOf(null, note.tags);
  const origin = {
    authorId: viewer.userId,
    authorName: viewer.name,
    clientId: cleanClientId(body.c),
  };

  const outcome: UpsertNoteResult =
    note.kind === "CODE"
      ? await upsertCodeNoteForUser(
          note.ownerId,
          { id, title, content, baseVersion: row.version, favorite, tags },
          origin,
        )
      : await upsertNoteForUser(
          note.ownerId,
          { id, title, kind: note.kind, favorite, tags, content, baseVersion: row.version },
          origin,
        );

  switch (outcome.status) {
    case "saved":
    case "created":
    case "unchanged":
      return json({ status: "ok", version: outcome.version });
    case "conflict":
      return json({ status: "stale", version: outcome.onServer.version });
    case "gone":
      return json({ status: "gone", version: 0 }, 410);
    case "error":
      return error(outcome.code, outcome.message, outcome.httpStatus);
  }
});
