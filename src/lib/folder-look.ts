/*
  Wygląd folderu: barwa i ikona.

  Jedno i drugie jest zapisane przy folderze w bazie (`colorId`, `iconId`) i
  czyta to także aplikacja na tablecie. Spisy niżej są lustrem tego, co siedzi
  w aplikacji - FolderColor w core/design/Colors.kt oraz KajetIcons.folderIcons.
  Kiedy tam coś dojdzie, dopisz to tutaj, żeby folder wyglądał tak samo po obu
  stronach.
*/

import type { IconName } from "@/lib/icon-names";

export type FolderColour = {
  id: string;
  label: string;
  labelEn: string;
  /** Barwa na jasnej kartce i jej odpowiednik na ciemnej. */
  light: string;
  dark: string;
};

export const FOLDER_COLOURS: FolderColour[] = [
  { id: "grafit", label: "Grafit", labelEn: "Graphite", light: "#5b584f", dark: "#8e8a7e" },
  { id: "zielen", label: "Zieleń", labelEn: "Green ink", light: "#0f6b5c", dark: "#4fb39c" },
  { id: "morski", label: "Morski", labelEn: "Teal", light: "#1c5c74", dark: "#5aa8c4" },
  { id: "ceglany", label: "Ceglany", labelEn: "Brick", light: "#a6392e", dark: "#e2857a" },
  { id: "musztarda", label: "Musztardowy", labelEn: "Mustard", light: "#8a6212", dark: "#d6a648" },
  { id: "oliwka", label: "Oliwkowy", labelEn: "Olive", light: "#56662a", dark: "#9eb367" },
  { id: "rdza", label: "Rdzawy", labelEn: "Rust", light: "#8f4a1c", dark: "#d08a55" },
  { id: "granat", label: "Granatowy", labelEn: "Navy", light: "#2c3e6b", dark: "#7c90c0" },
  { id: "fiolet", label: "Fioletowy", labelEn: "Violet", light: "#5b3e8c", dark: "#9e86c9" },
  { id: "roz", label: "Różowy", labelEn: "Rose", light: "#9c3a63", dark: "#d887a8" },
  { id: "braz", label: "Brązowy", labelEn: "Chocolate", light: "#5f4630", dark: "#a98a66" },
  { id: "bez", label: "Bezbarwny", labelEn: "Plain", light: "#8c877c", dark: "#6e6a61" },
];

export function folderColour(id: string | null | undefined): FolderColour {
  return FOLDER_COLOURS.find((entry) => entry.id === id) ?? FOLDER_COLOURS[0];
}

/*
  Identyfikator ikony zapisany przy folderze -> nazwa ikony z
  fonts.google.com/icons. Ta sama para stoi w tools/ikony.mjs po stronie
  aplikacji, więc folder „kolba" ma tam i tu ten sam rysunek.
*/
/** Nazwa w wybranym języku - te same nazwy nosi aplikacja. */
export function lookLabel(entry: { label: string; labelEn: string }, english: boolean): string {
  return english ? entry.labelEn : entry.label;
}

export const FOLDER_ICONS: { id: string; label: string; labelEn: string; icon: IconName }[] = [
  { id: "folder", label: "Folder", labelEn: "Folder", icon: "folder" },
  { id: "ksiazki", label: "Książki", labelEn: "Books", icon: "local_library" },
  { id: "litery", label: "Litery", labelEn: "Letters", icon: "abc" },
  { id: "dzialania", label: "Działania", labelEn: "Arithmetic", icon: "calculate" },
  { id: "nuta", label: "Nuta", labelEn: "Music note", icon: "music_note" },
  { id: "kolba", label: "Kolba", labelEn: "Flask", icon: "science" },
  { id: "globus", label: "Globus", labelEn: "Globe", icon: "public" },
  { id: "kod", label: "Kod", labelEn: "Code", icon: "code" },
  { id: "gwiazdka", label: "Gwiazdka", labelEn: "Star", icon: "star" },
  { id: "pedzel", label: "Pędzel", labelEn: "Brush", icon: "brush" },
  { id: "serce", label: "Serce", labelEn: "Heart", icon: "favorite" },
  { id: "atom", label: "Atom", labelEn: "Atom", icon: "biotech" },
  { id: "dna", label: "DNA", labelEn: "DNA strand", icon: "genetics" },
  { id: "mapa", label: "Mapa", labelEn: "Map", icon: "map" },
  { id: "zebatka", label: "Zębatka", labelEn: "Cog", icon: "settings" },
  { id: "zarowka", label: "Żarówka", labelEn: "Light bulb", icon: "lightbulb" },
  { id: "kompas", label: "Kompas", labelEn: "Compass", icon: "explore" },
  { id: "rakieta", label: "Rakieta", labelEn: "Rocket", icon: "rocket_launch" },
  { id: "korona", label: "Korona", labelEn: "Crown", icon: "workspace_premium" },
  { id: "filizanka", label: "Filiżanka", labelEn: "Cup", icon: "local_cafe" },
  { id: "drzewo", label: "Drzewo", labelEn: "Tree", icon: "park" },
  { id: "gora", label: "Góra", labelEn: "Mountain", icon: "landscape" },
  { id: "cloud", label: "Chmura", labelEn: "Cloud", icon: "cloud" },
  { id: "klucz", label: "Klucz", labelEn: "Key", icon: "key" },
  { id: "zegar", label: "Zegar", labelEn: "Clock", icon: "schedule" },
  { id: "kalendarz", label: "Kalendarz", labelEn: "Calendar", icon: "calendar_month" },
  { id: "flaga", label: "Flaga", labelEn: "Flag", icon: "flag" },
  { id: "mikroskop", label: "Mikroskop", labelEn: "Microscope", icon: "biotech" },
  { id: "pilka", label: "Piłka", labelEn: "Ball", icon: "sports_soccer" },
  { id: "maska", label: "Maska", labelEn: "Mask", icon: "theater_comedy" },
  { id: "waga", label: "Waga", labelEn: "Scales", icon: "balance" },
  { id: "tarcza", label: "Tarcza", labelEn: "Shield", icon: "shield" },
  { id: "dom", label: "Dom", labelEn: "House", icon: "home" },
  { id: "aparat", label: "Aparat", labelEn: "Camera", icon: "photo_camera" },
  { id: "zdjecie", label: "Zdjęcie", labelEn: "Photo", icon: "image" },
  { id: "rysunek", label: "Rysunek", labelEn: "Drawing", icon: "gesture" },
  { id: "wezel", label: "Węzeł", labelEn: "Node", icon: "add_box" },
  { id: "tag", label: "Etykieta", labelEn: "Tag", icon: "label" },
];

export function folderIcon(id: string | null | undefined): IconName {
  return FOLDER_ICONS.find((entry) => entry.id === id)?.icon ?? "folder";
}

/** Styl w barwie folderu, z osobną wartością na ciemną kartkę. */
export function folderTint(colorId: string | null | undefined): React.CSSProperties {
  const colour = folderColour(colorId);
  return {
    ["--tint" as string]: colour.light,
    ["--tint-dark" as string]: colour.dark,
  };
}
