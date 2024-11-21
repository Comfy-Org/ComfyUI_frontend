import type { Positionable } from "../interfaces"
import { LGraphNode } from "@/LGraphNode"

/**
 * Creates a flat set of all positionable items by recursively iterating through all child items.
 *
 * Does not include or recurse into pinned items.
 * @param items The original set of items to iterate through
 * @returns All unpinned items in the original set, and recursively, their children
 */
export function getAllNestedItems(items: ReadonlySet<Positionable>): Set<Positionable> {
  const allItems = new Set<Positionable>()
  items?.forEach(x => addRecursively(x, allItems))
  return allItems

  function addRecursively(item: Positionable, flatSet: Set<Positionable>): void {
    if (flatSet.has(item) || item.pinned) return
    flatSet.add(item)
    item.children?.forEach(x => addRecursively(x, flatSet))
  }
}

/**
 * Iterates through a collection of {@link Positionable} items, returning the first {@link LGraphNode}.
 * @param items The items to search through
 * @returns The first node found in {@link items}, otherwise `undefined`
 */
export function findFirstNode(items: Iterable<Positionable>): LGraphNode | undefined {
  for (const item of items) {
    if (item instanceof LGraphNode) return item
  }
}
