/** Semantic identity for one serializable widget among same-named siblings. */
export interface WidgetIdentity {
  name: string;
  occurrence: number;
}

/**
 * Occurrence zero keeps the legacy key so selectors and single-name catalogs
 * retain their existing storage. Reserved-looking names are escaped into the
 * same tuple encoding, so arbitrary catalog strings cannot collide with a
 * later occurrence's doc-internal key.
 */
const OCCURRENCE_PREFIX = "\u0000widget-occurrence:";

export function widgetStorageKey(name: string, occurrence = 0): string {
  return occurrence === 0 && !name.startsWith(OCCURRENCE_PREFIX)
    ? name
    : `${OCCURRENCE_PREFIX}${JSON.stringify([name, occurrence])}`;
}

export function widgetIdentityFromStorageKey(key: string): WidgetIdentity {
  if (!key.startsWith(OCCURRENCE_PREFIX)) return { name: key, occurrence: 0 };
  try {
    const parsed: unknown = JSON.parse(key.slice(OCCURRENCE_PREFIX.length));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "string" &&
      Number.isInteger(parsed[1]) &&
      (parsed[1] as number) >= 0
    ) {
      return { name: parsed[0], occurrence: parsed[1] as number };
    }
  } catch {
    // A malformed reserved-looking key is treated as an ordinary legacy name.
  }
  return { name: key, occurrence: 0 };
}

export function widgetOccurrenceAt(order: readonly string[], index: number): number {
  const name = order[index];
  let occurrence = 0;
  for (let i = 0; i < index; i++) if (order[i] === name) occurrence++;
  return occurrence;
}

export function widgetIndexOf(order: readonly string[], name: string, occurrence: number): number {
  let seen = 0;
  for (let i = 0; i < order.length; i++) {
    if (order[i] !== name) continue;
    if (seen === occurrence) return i;
    seen++;
  }
  return -1;
}
