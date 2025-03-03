import type { ConnectingLink, Positionable } from "../interfaces"
import type { LinkId } from "@/LLink"

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
  if (items) {
    for (const item of items) addRecursively(item, allItems)
  }
  return allItems

  function addRecursively(item: Positionable, flatSet: Set<Positionable>): void {
    if (flatSet.has(item) || item.pinned) return
    flatSet.add(item)
    if (item.children) {
      for (const child of item.children) addRecursively(child, flatSet)
    }
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

/** @returns `true` if the provided link ID is currently being dragged. */
export function isDraggingLink(linkId: LinkId, connectingLinks: ConnectingLink[] | null | undefined): ConnectingLink | undefined {
  if (connectingLinks == null) return

  for (const connectingLink of connectingLinks) {
    if (connectingLink.link == null) continue
    if (linkId === connectingLink.link.id) return connectingLink
  }
}
