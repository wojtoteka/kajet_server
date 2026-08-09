"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

// Separatory spoza klawiatury, żeby sklejenie pól w jeden napis było
// jednoznaczne: żadna wpisana treść ich nie zawiera.
const SEP = String.fromCharCode(0);
const BREAK = String.fromCharCode(1);

/**
 * Autozapis jak w aplikacji: co pół sekundy porównuje zawartość formularza
 * z tym, co ostatnio poszło na serwer, i po krótkiej pauzie w pisaniu woła
 * akcję zapisu.
 *
 * Celowo NIE wysyła formularza (requestSubmit): prawdziwe wysłanie resetuje
 * pola i zabiera fokus — pisanie stawało się niemożliwe, a rysowanie ginęło.
 * Zamiast tego zbiera FormData i przekazuje je prosto do akcji z
 * useActionState, więc strona zachowuje się, jakby nic się nie działo.
 *
 * Do wysyłki dokładamy pole `autosave=1`. Po tym serwer poznaje, że to zapis
 * w tle: nie odświeża wtedy ścieżki otwartej notatki (revalidatePath), bo
 * przerysowanie całej strony w trakcie pisania gubiło kursor, a nowej notatki
 * nie kończy przekierowaniem, tylko oddaje jej identyfikator.
 *
 * Poza zegarem zapis leci też, gdy karta schodzi w tło albo okno traci
 * skupienie — czyli wtedy, kiedy człowiek najczęściej „wychodzi” z notatki.
 * Gdy mimo wszystko zostają zmiany niezapisane, przeglądarka pyta przed
 * zamknięciem karty.
 *
 * `enabled` włącza pilnowanie. Przy istniejącej notatce zawsze true; przy
 * nowej dopiero, gdy jest co zapisywać (inaczej samo wejście na „nowa
 * notatka” zakładałoby pustą).
 *
 * `auto` to ustawienie konta „Auto zapis". Wyłączone NIE wyłącza pilnowania:
 * zegar dalej chodzi, więc widać „Zmiany niezapisane", Ctrl+S zapisuje na
 * żądanie, a przeglądarka pyta przed zamknięciem karty z niezapisaną zmianą.
 * Sam z siebie zapis wtedy nie leci - od tego jest przycisk „Zapisz".
 */
export function useAutosave({
  formRef,
  enabled,
  auto = true,
  busy,
  save,
  tickMs = 500,
  quietMs = 1200,
}: {
  formRef: RefObject<HTMLFormElement | null>;
  enabled: boolean;
  /** Ustawienie konta: czy zapis ma iść sam z siebie. */
  auto?: boolean;
  busy: boolean;
  /** Akcja zapisu — dispatch z useActionState, owinięty w startTransition. */
  save: (data: FormData) => void;
  /** Co ile sprawdzamy formularz. */
  tickMs?: number;
  /** Ile ciszy musi być, zanim ruszy zapis. */
  quietMs?: number;
}): {
  /** Są zmiany, których serwer jeszcze nie widział. */
  dirty: boolean;
  /** Zapisz teraz, jeśli jest co zapisywać. `force` pomija ustawienie `auto`. */
  flush: (force?: boolean) => void;
  /**
   * „To już poszło na serwer" - do ręcznego zapisu przyciskiem, żeby zaraz po
   * nim autozapis nie wysłał tej samej treści drugi raz.
   */
  markSent: () => void;
} {
  // Migawka wysłana na serwer, migawka z poprzedniego sprawdzenia i licznik
  // spokojnych sprawdzeń. Referencje, nie stan — zmiana nie ma czego
  // przerysowywać.
  const lastSent = useRef<string | null>(null);
  const lastSeen = useRef<string | null>(null);
  const quietTicks = useRef(0);
  const [dirty, setDirty] = useState(false);

  const busyNow = useRef(busy);
  busyNow.current = busy;
  const saveNow = useRef(save);
  saveNow.current = save;
  const enabledNow = useRef(enabled);
  enabledNow.current = enabled;
  const autoNow = useRef(auto);
  autoNow.current = auto;

  // Ostatni znany formularz. Przy odmontowaniu React zeruje formRef, a my
  // chcemy wtedy jeszcze dosłać zmiany — na odczepionym od strony formularzu
  // FormData działa tak samo dobrze.
  const lastForm = useRef<HTMLFormElement | null>(null);
  const readForm = useCallback(
    () => formRef.current ?? lastForm.current,
    [formRef],
  );

  const snapshot = useCallback((): string | null => {
    const form = readForm();
    if (!form) return null;
    lastForm.current = form;
    const data = new FormData(form);
    const parts: string[] = [];
    data.forEach((value, key) => {
      // Pliki (załączniki) mają własny formularz; tu liczy się sam tekst.
      // baseVersion rośnie po każdym zapisie, a noteId pojawia się po
      // założeniu nowej notatki — same z siebie wyglądałyby jak kolejna
      // zmiana do zapisania.
      if (key === "baseVersion" || key === "noteId" || key === "autosave") return;
      if (typeof value === "string") parts.push(key + SEP + value);
    });
    return parts.join(BREAK);
  }, [readForm]);

  const remember = useCallback((now: string | null) => {
    lastSent.current = now;
    lastSeen.current = now;
    quietTicks.current = 0;
    setDirty(false);
  }, []);

  const markSent = useCallback(() => remember(snapshot()), [remember, snapshot]);

  const send = useCallback(
    (now: string) => {
      const form = readForm();
      if (!form) return;
      remember(now);
      const data = new FormData(form);
      data.set("autosave", "1");
      saveNow.current(data);
    },
    [readForm, remember],
  );

  // Stan z chwili otwarcia strony to stan zapisany.
  useEffect(() => {
    if (lastSent.current !== null) return;
    const first = snapshot();
    lastSent.current = first;
    lastSeen.current = first;
  }, [snapshot]);

  const flush = useCallback(
    (force = false) => {
      if (!enabledNow.current || busyNow.current) return;
      // Przy wyłączonym autozapisie zapis leci tylko na żądanie (Ctrl+S).
      if (!autoNow.current && !force) return;
      const now = snapshot();
      if (now === null || now === lastSent.current) return;
      send(now);
    },
    [snapshot, send],
  );

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      const now = snapshot();
      if (now === null) return;
      if (now === lastSent.current) {
        lastSeen.current = now;
        quietTicks.current = 0;
        setDirty(false);
        return;
      }
      setDirty(true);
      // Autozapis wyłączony w ustawieniach: znamy stan („Zmiany niezapisane"),
      // ale nic nie wysyłamy.
      if (!autoNow.current) return;
      // Zapis w locie — poczekajmy na odpowiedź, żeby nie wysłać dwóch naraz
      // (przy nowej notatce zrobiłoby to dwie notatki zamiast jednej).
      if (busyNow.current) return;
      if (now !== lastSeen.current) {
        // Coś się zmieniło, ale pisanie może trwać — czekamy jeszcze chwilę.
        lastSeen.current = now;
        quietTicks.current = 0;
        return;
      }
      quietTicks.current += 1;
      if (quietTicks.current * tickMs < quietMs) return;
      send(now);
    }, tickMs);
    return () => window.clearInterval(timer);
  }, [enabled, snapshot, send, tickMs, quietMs]);

  // Koniec pisania to nie tylko cisza na zegarze. Zejście karty w tło,
  // przełączenie okna i kliknięcie poza notatkę (na przykład w „Wróć do
  // listy") też nim są — wtedy zapis leci od razu, bez czekania.
  useEffect(() => {
    if (!enabled) return;
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onPointerDown = (event: PointerEvent) => {
      const form = formRef.current;
      const target = event.target as Node | null;
      if (!form || !target || form.contains(target)) return;
      flush();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      // Ctrl+S zapisuje notatkę, a nie stronę w przeglądarce. To zapis na
      // żądanie, więc działa też przy wyłączonym autozapisie.
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      flush(true);
    };
    // Zdarzenia wołamy przez własną funkcję: `flush` wprost dostałby obiekt
    // zdarzenia jako `force` i zapisywałby mimo wyłączonego autozapisu.
    const onBlur = () => flush();
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onHidden);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onHidden);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [enabled, flush, formRef]);

  // Wyjście z notatki w obrębie strony („Wróć do listy") nie odpala żadnego
  // zdarzenia okna — dlatego przy odmontowaniu dosyłamy to, co zostało.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  // Ostatnia siatka bezpieczeństwa: zamknięcie karty z niezapisaną zmianą.
  useEffect(() => {
    if (!dirty) return;
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [dirty]);

  return { dirty, flush, markSent };
}
