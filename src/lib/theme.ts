/*
  Motyw strony: jasny, ciemny albo taki, jaki ma system.

  Domyślnie obowiązuje system - arkusz sam idzie za `prefers-color-scheme`
  i nikt nic nie musi wybierać. Wybór człowieka zapisuje się jako `data-theme`
  na <html>, bo globals.css umie go przebić w obie strony:
  `:root:not([data-theme="light"])` w bloku systemowym i `:root[data-theme="dark"]`
  niżej. Brak atrybutu znaczy „jak w systemie".

  Wybór siedzi w localStorage przeglądarki, nie przy koncie: dotyczy tego, jak
  patrzy się na ten ekran, a nie tego, czyja jest notatka. Dzięki temu działa
  też bez logowania - na stronie logowania i przy notatce z odnośnika.
*/

export type ThemeChoice = "system" | "light" | "dark";

/** Klucz w localStorage. Zmiana nazwy skasuje ludziom dotychczasowy wybór. */
export const THEME_STORAGE_KEY = "kajet-motyw";

/** Barwa biurka w obu motywach - stąd bierze ją też pasek przeglądarki. */
export const DESK_LIGHT = "#e7e2d6";
export const DESK_DARK = "#171614";

// Nazwy motywów stoją w słowniku (lib/i18n.ts), bo widzi je człowiek.
export const THEME_CHOICES: { id: ThemeChoice; icon: string }[] = [
  { id: "system", icon: "brightness_auto" },
  { id: "light", icon: "light_mode" },
  { id: "dark", icon: "dark_mode" },
];

/** Nieznana albo pusta wartość (stary zapis, ręczna zabawa) na „systemowy". */
export function knownTheme(value: string | null | undefined): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

/*
  Skrypt wczytywany w <head>, przed pierwszym rysowaniem strony. Bez niego
  strona mrugnęłaby systemowym motywem, zanim React zdąży postawić atrybut.
  Dlatego jest to goły tekst wstrzykiwany do <script>, a nie komponent.

  Znacznik w layout.tsx ma `data-cfasync="false"` - bez tego Cloudflare
  odkłada ten skrypt na po przeczytaniu całego dokumentu i mrugnięcie wraca.
*/
export const THEME_BOOT_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(c==="light"||c==="dark"){document.documentElement.dataset.theme=c;}}catch(e){}})();`;

/** Czy przy tym wyborze arkusz jest ciemny. „System" pyta przeglądarkę. */
export function themeIsDark(choice: ThemeChoice): boolean {
  if (choice !== "system") return choice === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Postawienie wyboru na stronie. Tylko w przeglądarce - w kodzie serwera
 * nie ma `document`.
 */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;

  /*
    Pasek przeglądarki na telefonie. Layout wpisuje dwa znaczniki theme-color
    z zapytaniem o motyw systemu; przy wyborze ręcznym oba dostają tę samą
    barwę, żeby pasek nie kłócił się z arkuszem. Powrót na „systemowy"
    przywraca im barwy z zapytań.
  */
  const bars = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  for (const bar of bars) {
    const own = bar.media.includes("dark") ? DESK_DARK : DESK_LIGHT;
    bar.content = choice === "system" ? own : choice === "dark" ? DESK_DARK : DESK_LIGHT;
  }
}
