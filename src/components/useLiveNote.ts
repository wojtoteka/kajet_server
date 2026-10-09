"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyDelta, jsonEqual, merge3, type Delta, type Json } from "@/lib/live/merge";
import type { LivePerson } from "@/lib/live/bus";

/*
  Edycja na żywo w edytorze na stronie.

  Edytor trzyma swój kawałek notatki (tekst, węzły mapy, strony kartki) i sam
  go zapisuje, jak dotąd - autozapisem przez akcję serwera. Ten hak dokłada
  drugi kierunek: zmiany zrobione gdzie indziej (w innej karcie, na tablecie,
  na telefonie) przychodzą strumieniem i wchodzą do edytora bez odświeżania.

  Jak się scala: mamy trzy wersje kawałka - bazę (to, co ostatnio widział
  serwer), to, co jest teraz w edytorze, i nową wersję z serwera. merge3
  składa obie zmiany; człowiek pisze dalej, kursor zostaje na miejscu.

  Oszczędnie z danymi: przy otwarciu strony NIE pobieramy notatki drugi raz -
  edytor ma ją już z HTML-a. Pełną treść dociągamy dopiero wtedy, gdy
  przyjdzie pierwsza cudza zmiana (bez niej nie ma do czego przyłożyć delty).
  Kto pisze sam, dostaje przez cały czas tylko echo własnych zapisów i co 20
  sekund pusty sygnał podtrzymania.
*/

export type LiveStatus = "off" | "connecting" | "live" | "offline";

export type LiveNote<P> = {
  status: LiveStatus;
  /** Inni ludzie z notatką otwartą w tej chwili (bez tej karty). */
  people: LivePerson[];
  /** Najnowsza wersja znana tej karcie - jedzie jako baseVersion zapisu. */
  version: number | undefined;
  /** Karta przedstawia się nim serwerowi - po nim poznaje echo. */
  clientId: string;
  /** Notatkę skasowano albo odebrano dostęp. */
  gone: boolean;
  /** Kto ostatnio coś zmienił z zewnątrz - na krótką chwilę przy pasku zapisu. */
  lastAuthor: { name: string; at: number } | null;
  /** Edytor właśnie wysyła ten kawałek - po echu stanie się bazą. */
  sending: (piece: P) => void;
  /** Zapis odbił się od nowszej wersji - dociągamy, co się zmieniło. */
  resync: () => void;
};

function newClientId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(36).padStart(2, "0")).join("").slice(0, 16);
}

/** Opóźnienia kolejnych prób połączenia: szybko na początku, potem rzadziej. */
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 20_000];

export function useLiveNote<P>({
  noteId,
  token,
  version,
  initial,
  pieceOf,
  read,
  write,
}: {
  /** Pusty przy notatce jeszcze niezałożonej - wtedy nic nie słuchamy. */
  noteId?: string;
  /** Odnośnik, którym ktoś wszedł (strona /n/...). */
  token?: string;
  /** Wersja notatki, z której zbudowano edytor. */
  version?: number;
  /** Kawałek z chwili otwarcia - baza pierwszego scalenia. */
  initial: P;
  /** Wyciąga kawałek edytora z całego dokumentu notatki. */
  pieceOf: (document: Json) => P | null;
  /** To, co jest teraz w edytorze. */
  read: () => P;
  /**
   * Podmienia zawartość edytora na scaloną. `clean` mówi, że w edytorze nie
   * było nic niezapisanego - autozapis nie musi więc niczego odsyłać.
   */
  write: (merged: P, info: { clean: boolean; author: string }) => void;
}): LiveNote<P> {
  const [clientId] = useState(newClientId);
  const [status, setStatus] = useState<LiveStatus>(noteId ? "connecting" : "off");
  const [people, setPeople] = useState<LivePerson[]>([]);
  const [knownVersion, setKnownVersion] = useState(version);
  const [gone, setGone] = useState(false);
  const [lastAuthor, setLastAuthor] = useState<{ name: string; at: number } | null>(null);

  const base = useRef<P>(initial);
  const baseDoc = useRef<Json | null>(null);
  /** Wersja, której odpowiada baza - po niej dociągamy zmiany. */
  const docVersion = useRef(version ?? 0);
  /** Najnowsza wersja znana karcie - może wyprzedzać bazę (odpowiedź zapisu). */
  const versionRef = useRef(version ?? 0);
  const lastSent = useRef<P | null>(null);
  const callbacks = useRef({ pieceOf, read, write });
  callbacks.current = { pieceOf, read, write };
  const reconnect = useRef<(full: boolean) => void>(() => {});

  const bump = useCallback((next: number) => {
    if (next <= versionRef.current) return;
    versionRef.current = next;
    setKnownVersion(next);
  }, []);

  // Wersja z zapisu tej karty (odpowiedź akcji) też jest wiedzą o serwerze.
  useEffect(() => {
    if (version != null) bump(version);
  }, [version, bump]);

  /** Nowy stan serwera: scala go z edytorem i przesuwa bazę. */
  const absorb = useCallback((document: Json, author: string) => {
    const { pieceOf: project, read: current, write: replace } = callbacks.current;
    const theirs = project(document);
    baseDoc.current = document;
    if (theirs === null) return;
    const local = current();
    const clean = jsonEqual(local as Json, base.current as Json);
    const merged = merge3(base.current as Json, local as Json, theirs as Json) as P;
    base.current = theirs;
    if (!jsonEqual(merged as Json, local as Json)) replace(merged, { clean, author });
    if (author) setLastAuthor({ name: author, at: Date.now() });
  }, []);

  useEffect(() => {
    if (!noteId) return;
    let source: EventSource | null = null;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const open = (full: boolean) => {
      if (stopped) return;
      source?.close();
      if (timer) clearTimeout(timer);
      setStatus("connecting");
      const since = full ? 0 : docVersion.current;
      const query = new URLSearchParams({ since: String(since), c: clientId });
      if (token) query.set("t", token);
      const stream = new EventSource(`/api/v1/live/${encodeURIComponent(noteId)}?${query}`);
      source = stream;

      stream.addEventListener("hello", (event) => {
        const data = JSON.parse((event as MessageEvent).data) as {
          version: number;
          people: LivePerson[];
        };
        retries = 0;
        setStatus("live");
        bump(data.version);
        setPeople(data.people.filter((person) => person.client !== clientId));
      });

      stream.addEventListener("people", (event) => {
        const list = JSON.parse((event as MessageEvent).data) as LivePerson[];
        setPeople(list.filter((person) => person.client !== clientId));
      });

      stream.addEventListener("reset", (event) => {
        const data = JSON.parse((event as MessageEvent).data) as { v: number; content: string };
        let document: Json;
        try {
          document = JSON.parse(data.content) as Json;
        } catch {
          return;
        }
        absorb(document, "");
        docVersion.current = data.v;
        bump(data.v);
      });

      stream.addEventListener("change", (event) => {
        const data = JSON.parse((event as MessageEvent).data) as {
          v: number;
          by: string;
          name: string;
          d: Delta;
        };
        if (data.v <= docVersion.current) return;

        if (data.by === clientId) {
          // Echo własnego zapisu. Bazą staje się to, co wysłaliśmy - bez
          // scalania, bo edytor ma to już u siebie (i może pisać dalej).
          if (baseDoc.current !== null) {
            baseDoc.current = applyDelta(baseDoc.current, data.d);
            const projected = callbacks.current.pieceOf(baseDoc.current);
            if (projected !== null) base.current = projected;
          } else if (lastSent.current !== null) {
            base.current = lastSent.current;
          }
          docVersion.current = data.v;
          bump(data.v);
          return;
        }

        if (baseDoc.current === null) {
          // Pierwsza cudza zmiana - dopiero teraz potrzebujemy całej notatki.
          open(true);
          return;
        }
        absorb(applyDelta(baseDoc.current, data.d), data.name);
        docVersion.current = data.v;
        bump(data.v);
      });

      stream.addEventListener("gone", () => {
        setGone(true);
        stopped = true;
        stream.close();
      });

      stream.onerror = () => {
        if (stopped) return;
        stream.close();
        setStatus("offline");
        const wait = RETRY_MS[Math.min(retries, RETRY_MS.length - 1)];
        retries += 1;
        timer = setTimeout(() => open(false), wait);
      };
    };

    reconnect.current = open;
    open(false);

    // Powrót do karty po uśpieniu laptopa - nie czekamy na zegar ponowień.
    const onVisible = () => {
      if (document.visibilityState === "visible" && source?.readyState === EventSource.CLOSED) {
        open(false);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      source?.close();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [noteId, token, clientId, absorb, bump]);

  const sending = useCallback((piece: P) => {
    lastSent.current = piece;
  }, []);

  const resync = useCallback(() => reconnect.current(false), []);

  return { status, people, version: knownVersion, clientId, gone, lastAuthor, sending, resync };
}
