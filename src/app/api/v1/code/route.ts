import { z } from "zod";
import { error, userFromRequest, json, wrapApi } from "@/lib/api";
import { LANGUAGES, runnerState, run } from "@/lib/code-runner";
import { checkLimit, takeSlot } from "@/lib/run-limits";
import { settings } from "@/lib/settings";
import { apiWords } from "@/lib/language";

export { OPTIONS } from "@/lib/api";

const runRequest = z
  .object({
    language: z.string().min(1).max(32),
    code: z.string().max(200_000),
    input: z.string().max(100_000).optional(),
    // Older docs/clients said "stdin"; accept both.
    stdin: z.string().max(100_000).optional(),
  })
  .transform((value) => ({
    language: value.language,
    code: value.code,
    input: value.input ?? value.stdin ?? "",
  }));

export const GET = wrapApi(async (request: Request) => {
  const result = await userFromRequest(request);
  if ("errorResponse" in result) return result.errorResponse;

  const state = await runnerState();

  return json({
    works: state.works && result.user.canRunCode,
    description: result.user.canRunCode
      ? state.description
      : (await apiWords()).apiCodeRunningOffForAccount,
    languages: LANGUAGES.map(({ id, namePl, extension }) => ({ id, namePl, extension })),
    timeoutSeconds: settings.code.timeoutSeconds,
    runsPerMinute: settings.code.runsPerMinute,
  });
});

export const POST = wrapApi(async (request: Request) => {
  const result = await userFromRequest(request);
  if ("errorResponse" in result) return result.errorResponse;
  const user = result.user;

  if (!user.canRunCode) {
    return error(
      "not-allowed",
      (await apiWords()).apiCodeRunningOffKeepWriting,
      403,
    );
  }

  const limit = checkLimit(user.id);
  if (!limit.allowed) {
    return error("too-often", limit.message, 429);
  }

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return error("bad-request", (await apiWords()).apiBadRequest, 400);
  }

  const parsed = runRequest.safeParse(data);
  if (!parsed.success) {
    return error("bad-request", (await apiWords()).apiGiveLanguageAndCode, 400);
  }

  const { language, code, input } = parsed.data;
  if (!code.trim()) {
    return json({
      output: "",
      errors: (await apiWords()).apiNothingToRun,
      exitCode: 0,
      interrupted: false,
      timeMs: 0,
    });
  }

  // A slot on the machine. The server normally stands next to other things
  // belonging to the same owner and has no business knocking them over
  // because somebody is learning loops.
  const slot = takeSlot(await apiWords());
  if (!slot.taken) {
    return error("server-busy", slot.message, 503);
  }

  try {
    return json(await run(language, code, input));
  } finally {
    slot.release();
  }
});
