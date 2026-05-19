import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { PackNode } from '../data/cloudNodes'

const UNCATEGORIZED = '—'

interface NodeCategoryGroup {
  category: string
  nodes: PackNode[]
}

export function useNodesByCategory(
  nodes: MaybeRefOrGetter<readonly PackNode[]>
) {
  const groupedNodes = computed<NodeCategoryGroup[]>(() => {
    const byCategory = new Map<string, PackNode[]>()

    for (const node of toValue(nodes)) {
      const category = node.category || UNCATEGORIZED
      const existing = byCategory.get(category)
      if (existing) {
        existing.push(node)
        continue
      }
      byCategory.set(category, [node])
    }

    return [...byCategory.entries()]
      .map(([category, items]) => ({
        category,
        nodes: [...items].sort((a, b) =>
          a.displayName.localeCompare(b.displayName)
        )
      }))
      .sort((a, b) => a.category.localeCompare(b.category))
  })

  return { groupedNodes }
}
