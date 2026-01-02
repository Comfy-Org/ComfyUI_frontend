import type { Positionable } from '@/lib/litegraph/src/interfaces'
import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { isLGraphGroup, isLGraphNode } from '@/utils/litegraphUtil'

/**
 * Searches widgets in a list and returns search results.
 * Filters by name, localized label, type, and user-input value.
 * Performs basic tokenization of the query string.
 */
export function searchWidgets<T extends { widget: IBaseWidget }[]>(
  list: T,
  query: string
): T {
  if (query.trim() === '') {
    return list
  }
  const words = query.trim().toLowerCase().split(' ')
  return list.filter(({ widget }) => {
    const label = widget.label?.toLowerCase()
    const name = widget.name.toLowerCase()
    const type = widget.type.toLowerCase()
    const value = widget.value?.toString().toLowerCase()
    return words.every(
      (word) =>
        name.includes(word) ||
        label?.includes(word) ||
        type?.includes(word) ||
        value?.includes(word)
    )
  }) as T
}

export type MixedSelectionItem = LGraphGroup | LGraphNode
type FlatAndCategorizeSelectedItemsResult = {
  all: MixedSelectionItem[]
  nodes: LGraphNode[]
  groups: LGraphGroup[]
  others: Positionable[]
}

/**
 * The selected items may contain "Group" nodes, which can include child nodes.
 * This function flattens such structures and categorizes items into:
 * - all: all categorizable nodes (does not include nodes in "others")
 * - nodes: node items
 * - groups: group items
 * - others: items not currently supported
 * @param items The selected items to flatten and categorize
 * @returns An object containing arrays: all, nodes, groups, others
 */
export function flatAndCategorizeSelectedItems(
  items: Positionable[]
): FlatAndCategorizeSelectedItemsResult {
  const { all, nodes, groups, others } = flatItems(items)
  return {
    all: repeatItems(all),
    nodes: repeatItems(nodes),
    groups: repeatItems(groups),
    others: repeatItems(others)
  }
}

function flatItems(
  items: Positionable[]
): FlatAndCategorizeSelectedItemsResult {
  const result: MixedSelectionItem[] = []
  const nodes: LGraphNode[] = []
  const groups: LGraphGroup[] = []
  const others: Positionable[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as Positionable

    if (isLGraphGroup(item)) {
      result.push(item)
      groups.push(item)

      const children = Array.from(item._children)
      const {
        all: childAll,
        nodes: childNodes,
        groups: childGroups,
        others: childOthers
      } = flatItems(children)
      result.push(...childAll)
      nodes.push(...childNodes)
      groups.push(...childGroups)
      others.push(...childOthers)
    } else if (isLGraphNode(item)) {
      result.push(item)
      nodes.push(item)
    } else {
      // Other types of items are not supported yet
      // Do not add to all
      others.push(item)
    }
  }
  return {
    all: result,
    nodes,
    groups,
    others
  }
}

function repeatItems<T>(items: T[]): T[] {
  const itemSet = new Set<T>()
  const result: T[] = []
  for (const item of items) {
    if (itemSet.has(item)) continue
    itemSet.add(item)
    result.push(item)
  }
  return result
}
