import { computed } from 'vue'

import type { EssentialPlaceholderTile } from '@/constants/essentialsPlaceholders'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const BLUEPRINT_PREFIX = 'SubgraphBlueprint.'

export function useEssentialTileNodeDef(
  getTile: () => EssentialPlaceholderTile
) {
  const nodeDefStore = useNodeDefStore()
  return computed(() => {
    const name = getTile().nodeName
    if (!name) return undefined
    const byName = nodeDefStore.allNodeDefsByName[name]
    if (byName) return byName
    const target = name.startsWith(BLUEPRINT_PREFIX)
      ? name.slice(BLUEPRINT_PREFIX.length)
      : name
    return nodeDefStore.nodeDefs.find((d) => d.display_name === target)
  })
}
