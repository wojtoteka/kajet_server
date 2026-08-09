import { settings } from "./settings";
import type { Words } from "./i18n";

type Window = { start: number; count: number };

const counters = new Map<string, Window>();

const WINDOW_MS = 60_000;
const CLEANUP_EVERY = 500;

let sinceCleanup = 0;

export type LimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryInSeconds: number; message: string };

export function checkLimit(userId: string): LimitResult {
  const now = Date.now();
  const limit = settings.code.runsPerMinute;

  cleanupSometimes(now);

  const window = counters.get(userId);

  if (!window || now - window.start >= WINDOW_MS) {
    counters.set(userId, { start: now, count: 1 });
    return { allowed: true, remaining: limit - 1 };
  }

  if (window.count >= limit) {
    const retryIn = Math.ceil((WINDOW_MS - (now - window.start)) / 1000);
    return {
      allowed: false,
      retryInSeconds: retryIn,
      message:
        `Uruchomiłeś kod ${limit} razy w ciągu minuty. ` +
        `Odczekaj ${retryIn} s i spróbuj jeszcze raz.`,
    };
  }

  window.count += 1;
  return { allowed: true, remaining: limit - window.count };
}

function cleanupSometimes(now: number): void {
  sinceCleanup += 1;
  if (sinceCleanup < CLEANUP_EVERY) return;
  sinceCleanup = 0;

  for (const [id, window] of counters) {
    if (now - window.start >= WINDOW_MS) counters.delete(id);
  }
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
