/**
 * Wspólna mechanika mapowania surowego wyjścia AI na slug typu encji.
 * Model bywa proszony o typ po polsku i zwraca etykietę ("Wydarzenie
 * historyczne", "Duch / byt") albo wariant zapisu zamiast identyfikatora.
 */

/** Klucz porównania odporny na wielkość liter, diakrytyki, spacje i myślniki. */
export function canonicalTypeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Buduje mapę wariant → typ ze slugów, etykiet z plików locale i aliasów.
 * Pierwsze dopasowanie wygrywa, więc slug ma pierwszeństwo przed etykietą.
 */
export function buildTypeLookup<T extends string>(
  types: readonly T[],
  labelsByLocale: ReadonlyArray<Record<string, string>>,
  aliases?: Partial<Record<T, readonly string[]>>
): Map<string, T> {
  const lookup = new Map<string, T>();
  for (const type of types) {
    const variants = [
      type,
      ...labelsByLocale.map((labels) => labels[type]),
      ...(aliases?.[type] ?? [])
    ];
    for (const variant of variants) {
      if (!variant) {
        continue;
      }
      const key = canonicalTypeKey(variant);
      if (key && !lookup.has(key)) {
        lookup.set(key, type);
      }
    }
  }
  return lookup;
}
