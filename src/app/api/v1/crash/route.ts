/*
  Raporty o awariach aplikacji na Androida.

  Bez tokenu, jak `app/latest`: aplikacja potrafi wywrócić się zanim ktokolwiek
  się zaloguje, a wtedy raport jest najbardziej potrzebny. Kajet wysyła to sam
  przy najbliższym uruchomieniu, gdy jest sieć.

  Skoro punkt stoi otworem, pilnują go trzy granice z crash-limits.ts: ile
  raportów z jednego adresu na godzinę, jak duży może być jeden i ile ich
  zostaje w bazie. Gdy przy zapytaniu akurat jest ważny token, dopisujemy
  konto - ale jego brak niczego nie blokuje.
*/

import { error, json, wrapApi } from "@/lib/api";
import { userFromHeaders } from "@/lib/app-token";
import { callerAddress } from "@/lib/signin-limits";
import { crashAllowed, LONGEST_REPORT } from "@/lib/crash-limits";
import { crashBody, fingerprintOf, pruneCrashReports } from "@/lib/crash-report";
import { apiWords } from "@/lib/language";
import { prisma } from "@/lib/prisma";

export { OPTIONS } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = wrapApi(async (request: Request) => {
  const words = await apiWords();
  const from = callerAddress(request);

  const gate = await crashAllowed(from);
  if (!gate.allowed) {
    return error("too-often", words.apiCrashTooOften, 429, {
      "retry-after": String(gate.retryInSeconds),
    });
  }

  // Rozmiar sprawdzamy z nagłówka, zanim treść w ogóle wejdzie do pamięci.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > LONGEST_REPORT * 2) {
    return error("too-big", words.apiCrashTooBig, 413);
  }

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return error("bad-request", words.apiCrashUnreadable, 400);
  }

  const parsed = crashBody.safeParse(data);
  if (!parsed.success) {
    return error("bad-request", words.apiCrashUnreadable, 400);
  }
  const body = parsed.data;

  // Konto tylko jako dodatek. Nieważny token to nie powód, żeby zgubić raport.
  const identity = await userFromHeaders(request.headers).catch(() => null);
  const userId = identity?.ok ? identity.user.id : null;

  await prisma.crashReport.create({
    data: {
      appVersion: body.appVersion ?? null,
      versionCode: body.versionCode ?? null,
      device: body.device ?? null,
      android: body.android ?? null,
      thread: body.thread ?? null,
      fingerprint: fingerprintOf(body.report),
      report: body.report,
      fromAddress: from,
      userId,
    },
  });

  // Sprzątanie nie może kosztować raportu, który właśnie wszedł.
  await pruneCrashReports().catch((problem) => {
    console.error("[api/v1/crash] sprzątanie starych raportów", problem);
  });

  return json({ ok: true }, 201);
});
