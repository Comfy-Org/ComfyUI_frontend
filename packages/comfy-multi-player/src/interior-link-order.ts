import { compareStampKeys } from "./stamps.js";
import type { StampKey } from "./types.js";

export function addInteriorLinkOrder(
  order: unknown[],
  id: string,
  stamp: StampKey,
  priorAdditions: Record<string, StampKey>,
): string[] {
  const ids = order.map(String);
  const wasAdded = Object.hasOwn(priorAdditions, id);
  if (ids.includes(id) && !wasAdded) return ids;
  const additions = { ...priorAdditions, [id]: stamp };
  const withId = ids.includes(id) ? ids : [...ids, id];
  const imported = withId.filter((candidate) => !Object.hasOwn(additions, candidate));
  const added = withId.filter((candidate) => Object.hasOwn(additions, candidate));
  added.sort((a, b) => compareStampKeys(additions[a]!, additions[b]!));
  return [...imported, ...added];
}

/** The stored scalar order is already canonical for unchanged-schema readers. */
export function projectInteriorLinkOrder(order: unknown[]): string[] {
  return order.map(String);
}

export function removeInteriorLinkOrder(order: unknown[], id: string): unknown[] {
  return order.filter((entry) => String(entry) !== id);
}
