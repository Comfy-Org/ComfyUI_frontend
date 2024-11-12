import type { Parent } from "../interfaces"

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
