/*
  Pokoje otwartych notatek - kto ma notatkę otwartą i komu podać zmianę.

  Wszystko w pamięci procesu: serwer chodzi pod pm2 jako jeden proces, więc
  zmiana zapisana w jednym żądaniu trafia do pokoju, z którego słuchają
  pozostali. Gdyby kiedyś stanęło kilka procesów, zmiany i tak dotrą -
  strumień co kilka sekund sprawdza bazę (patrz POLL_MS w trasie /live) -
  tyle że z sekundowym opóźnieniem, a lista obecnych będzie lokalna.

  Pokój przechowujemy na globalThis: Next potrafi załadować ten sam moduł
  osobno dla akcji serwera i dla tras API, a pokój musi być jeden.
*/

import type { Delta } from "./merge";

export type LivePerson = {
  /** Identyfikator karty albo urządzenia. */
  client: string;
  name: string;
  /** Czy to aplikacja (tablet, telefon), czy przeglądarka. */
  app: boolean;
  /** Indeks barwy obecności - ten sam człowiek ma ten sam kolor wszędzie. */
  color: number;
};

export type LiveEvent =
  | { type: "change"; v: number; by: string; name: string; d: Delta }
  | { type: "reset"; v: number; content: string }
  | { type: "people"; people: LivePerson[] }
  | { type: "gone" };

type Listener = (event: LiveEvent) => void;

type Room = {
  members: Map<string, { person: LivePerson; listener: Listener }>;
  /** Najwyższa wersja, o której pokój już wie - dla sprawdzania bazy. */
  version: number;
};

type Bus = { rooms: Map<string, Room> };

const globalBus = globalThis as unknown as { __kajetLiveBus?: Bus };
const bus: Bus = globalBus.__kajetLiveBus ?? { rooms: new Map() };
globalBus.__kajetLiveBus = bus;

/** Barwa obecności z imienia - prosta, powtarzalna suma. */
export function personColor(name: string): number {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum = (sum * 31 + name.charCodeAt(i)) >>> 0;
  return sum % 8;
}

function roomFor(noteId: string): Room {
  let room = bus.rooms.get(noteId);
  if (!room) {
    room = { members: new Map(), version: 0 };
    bus.rooms.set(noteId, room);
  }
  return room;
}

export function people(noteId: string): LivePerson[] {
  const room = bus.rooms.get(noteId);
  if (!room) return [];
  return [...room.members.values()].map((member) => member.person);
}

function announcePeople(noteId: string): void {
  const room = bus.rooms.get(noteId);
  if (!room) return;
  const event: LiveEvent = { type: "people", people: people(noteId) };
  for (const member of room.members.values()) safely(member.listener, event);
}

function safely(listener: Listener, event: LiveEvent): void {
  try {
    listener(event);
  } catch (problem) {
    // Zerwany strumień jednego słuchacza nie może zatrzymać pozostałych.
    console.error("[live] słuchacz", problem);
  }
}

/**
 * Wejście do pokoju notatki. Ten sam [person.client] wchodzący drugi raz
 * (odświeżenie karty, ponowne połączenie aplikacji) zastępuje poprzednie
 * miejsce. Zwraca funkcję wyjścia.
 */
export function join(noteId: string, person: LivePerson, listener: Listener): () => void {
  const room = roomFor(noteId);
  const entry = { person, listener };
  room.members.set(person.client, entry);
  announcePeople(noteId);
  return () => {
    const current = bus.rooms.get(noteId);
    if (!current) return;
    if (current.members.get(person.client) === entry) current.members.delete(person.client);
    if (current.members.size === 0) bus.rooms.delete(noteId);
    else announcePeople(noteId);
  };
}

/** Podaje zmianę wszystkim w pokoju notatki. Bez pokoju nic nie robi. */
export function publish(noteId: string, event: LiveEvent): void {
  const room = bus.rooms.get(noteId);
  if (!room) return;
  if ((event.type === "change" || event.type === "reset") && event.v > room.version) {
    room.version = event.v;
  }
  for (const member of room.members.values()) safely(member.listener, event);
}

/** Czy ktokolwiek trzyma tę notatkę otwartą - po co liczyć deltę dla nikogo. */
export function hasListeners(noteId: string): boolean {
  return (bus.rooms.get(noteId)?.members.size ?? 0) > 0;
}

/** Najwyższa wersja znana pokojowi - strumień sprawdza po niej bazę. */
export function roomVersion(noteId: string): number {
  return bus.rooms.get(noteId)?.version ?? 0;
}

/** Tylko dla testów. */
export function resetBusForTests(): void {
  bus.rooms.clear();
}
