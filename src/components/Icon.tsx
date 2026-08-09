/*
  Ikony z fonts.google.com/icons (Material Symbols Rounded).

  Pismo ikonowe wczytuje layout.tsx. Nazwa ikony jest jej treścią - przeglądarka
  zamienia słowo na znak przez ligaturę, więc `<Icon name="delete" />` rysuje
  kosz. Nazwy bierzemy prosto ze strony Google, bez żadnego pośredniego spisu.

  Ikona sama w sobie nic nie mówi czytnikowi ekranu, dlatego domyślnie jest
  ukryta przed nim (aria-hidden). Kiedy stoi sama, bez podpisu obok, trzeba jej
  dać `label` - wtedy dostaje rolę obrazka i nazwę po polsku.
*/

export type IconName = string;

export function Icon({
  name,
  label,
  size = 20,
  filled = false,
  weight,
  className,
  style,
}: {
  name: IconName;
  /** Nazwa dla czytnika ekranu. Podaj, gdy ikona stoi bez tekstu obok. */
  label?: string;
  size?: number;
  /** Wersja wypełniona - używamy jej na oznaczenie stanu włączonego. */
  filled?: boolean;
  weight?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const settings = [
    `'FILL' ${filled ? 1 : 0}`,
    weight ? `'wght' ${weight}` : null,
    `'opsz' ${Math.round(size)}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <span
      className={className ? `ms ${className}` : "ms"}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      style={{
        fontSize: size,
        width: size,
        height: size,
        fontVariationSettings: settings,
        ...style,
      }}
    >
      {name}
    </span>
  );
}
