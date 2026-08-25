import { settings } from "./settings";
import { tooManyRuns } from "./i18n";
import type { Words } from "./i18n";
import { bucket, noteAttempt, retryInSeconds } from "./rate-limit";

/*
  Granice uruchamiania kodu.

  Dwie różne rzeczy i dlatego dwa różne miejsca:

  - ILE RAZY na minutę wolno jednemu kontu. To liczy się w bazie
    (rate-limit.ts), żeby przeżyć restart, tak samo jak zapora logowania.
  - ILE KONTENERÓW chodzi TERAZ na maszynie. To nie jest licznik, tylko stan
    tego procesu: kontenery odpalił on i to on wie, które jeszcze żyją. W bazie
    taki wpis zostałby po ubitym procesie na zawsze i zamknąłby uruchamianie
    kodu wszystkim, dopóki ktoś nie posprzątałby ręcznie.
*/

const WINDOW_MS = 60_000;

export type LimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryInSeconds: number; message: string };

export async function checkLimit(userId: string, words: Words): Promise<LimitResult> {
  const most = settings.code.runsPerMinute;
  const attempt = await noteAttempt(bucket("kod", userId), WINDOW_MS);

  if (attempt.hits > most) {
    const retryIn = retryInSeconds(attempt, WINDOW_MS);
    return {
      allowed: false,
      retryInSeconds: retryIn,
      message: tooManyRuns(words, most, retryIn),
    };
  }

  return { allowed: true, remaining: most - attempt.hits };
}

let runningNow = 0;

export type Slot = { taken: true; release: () => void } | { taken: false; message: string };

export function takeSlot(words: Words): Slot {
  const most = settings.code.maxConcurrent;

  if (runningNow >= most) {
    return {
      taken: false,
      message: `${words.apiServerBusy} ${words.apiTryInSeconds}`,
    };
  }

  runningNow += 1;
  let released = false;

  return {
    taken: true,
    // Releasing must survive being called twice, because it comes from a
    // finally block, which also runs when something inside failed.
    release: () => {
      if (released) return;
      released = true;
      runningNow = Math.max(0, runningNow - 1);
    },
  };
}

export function currentlyRunning(): number {
  return runningNow;
}
