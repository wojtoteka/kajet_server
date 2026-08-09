import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { userFromHeaders } from "./app-token";
import { apiWords } from "./language";

export function json(
  data: unknown,
  status = 200,
  headers?: Record<string, string>,
): NextResponse {
  // BigInt does not survive JSON, and storage quotas are exactly BigInt.
  // We turn them into text so precision is not lost on large numbers.
  const text = JSON.stringify(data, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  return new NextResponse(text, {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export function error(
  code: string,
  message: string,
  status: number,
  headers?: Record<string, string>,
): NextResponse {
  const response = json({ error: code, message }, status);
  for (const [name, value] of Object.entries(headers ?? {})) {
    response.headers.set(name, value);
  }
  return response;
}

/**
 * A database that is behind the schema throws a wall of Prisma text which then
 * shows up in the app as the reason nothing works. We recognise that one case
 * and say plainly what has to be done on the server.
 */
async function readableFailure(problem: unknown): Promise<string> {
  const text = problem instanceof Error ? problem.message : "";
  const words = await apiWords();

  if (/does not exist in the current database/i.test(text)) {
    // Nazwa brakującej tabeli zostaje W LOGU: administrator ma po czym poznać,
    // czego brakuje, a odpowiedź nie ma prawa nieść nazw ze schematu bazy.
    // Kiedyś szła wprost do klienta - razem z całym zdaniem po polsku, więc
    // po angielsku wychodził z tego bigos.
    const table = text.match(/The table `([^`]+)`/)?.[1];
    console.error(
      "[api/v1] baza starsza niż program",
      table ? `- brakuje tabeli ${table}` : "",
    );
    return words.apiDbBehind;
  }

  if (/Can't reach database server|ECONNREFUSED/i.test(text)) {
    return words.apiNoDatabase;
  }

  // Anything else stays in the server log. Prisma is talkative: its messages
  // carry table and column names, query shapes, even the duplicated value on
  // a unique violation - a free map of the database for an attacker.
  return words.apiUnexpected;
}

/**
 * Wraps an `/api/v1` route handler so unexpected throws still return JSON
 * with `message`, which is what the tablet reads.
 */
export function wrapApi<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (problem) {
      console.error("[api/v1]", problem);
      return error("server-error", await readableFailure(problem), 500);
    }
  };
}

export async function userFromRequest(
  request: Request,
): Promise<{ user: User } | { errorResponse: NextResponse }> {
  const result = await userFromHeaders(request.headers);

  if (result.ok) return { user: result.user };

  const words = await apiWords();
  const messages: Record<string, string> = {
    missing: words.apiNotSignedIn,
    invalid: words.apiTokenDead,
    expired: words.apiTokenExpired,
    blocked: words.apiAccountBlocked,
  };

  return {
    errorResponse: error(
      result.reason,
      messages[result.reason] ?? words.apiIdentityFailed,
      result.reason === "blocked" ? 403 : 401,
    ),
  };
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
