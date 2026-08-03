import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { userFromHeaders } from "./app-token";

export function json(data: unknown, status = 200): NextResponse {
  // BigInt does not survive JSON, and storage quotas are exactly BigInt.
  // We turn them into text so precision is not lost on large numbers.
  const text = JSON.stringify(data, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  return new NextResponse(text, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function error(code: string, message: string, status: number): NextResponse {
  return json({ error: code, message }, status);
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
      return error(
        "server-error",
        problem instanceof Error ? problem.message : "Nieoczekiwany błąd serwera.",
        500,
      );
    }
  };
}

export async function userFromRequest(
  request: Request,
): Promise<{ user: User } | { errorResponse: NextResponse }> {
  const result = await userFromHeaders(request.headers);

  if (result.ok) return { user: result.user };

  const messages: Record<string, string> = {
    missing: "Nie jesteś zalogowany. Zaloguj się w ustawieniach aplikacji.",
    invalid: "Ten token już nie działa. Zaloguj się jeszcze raz.",
    expired: "Token wygasł. Zaloguj się jeszcze raz.",
    blocked: "To konto zostało zablokowane. Napisz do administratora.",
  };

  return {
    errorResponse: error(
      result.reason,
      messages[result.reason] ?? "Nie udało się potwierdzić tożsamości.",
      result.reason === "blocked" ? 403 : 401,
    ),
  };
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
