import type { Parent, Positionable } from "../interfaces"
import { LGraphNode } from "@/LGraphNode"

/**
 * Creates a flat set of all items by recursively iterating through all child items.
 * @param items The original set of items to iterate through
 * @returns All items in the original set, and recursively, their children
 */
export function getAllNestedItems<TParent extends Parent<TParent>>(items: ReadonlySet<TParent>): Set<TParent> {
    const allItems = new Set<TParent>()
    items?.forEach(x => addRecursively(x, allItems))
    return allItems

    function addRecursively(item: TParent, flatSet: Set<TParent>): void {
        if (flatSet.has(item)) return
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
