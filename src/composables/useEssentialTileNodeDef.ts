import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { EssentialTile } from '@/constants/essentialsNodes'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { BLUEPRINT_TYPE_PREFIX } from '@/utils/blueprintUtils'

export function resolveEssentialTileNodeDef(
  tile: EssentialTile,
  nodeDefStore: ReturnType<typeof useNodeDefStore>
): ComfyNodeDefImpl | undefined {
  const name = tile.nodeName
  if (!name) return undefined
  if (!name.startsWith(BLUEPRINT_TYPE_PREFIX))
    return nodeDefStore.allNodeDefsByName[name]

  const subgraphName = name.slice(BLUEPRINT_TYPE_PREFIX.length)
  return nodeDefStore.allNodeDefsByDisplayName[subgraphName]
}

export function useEssentialTileNodeDef(tile: MaybeRefOrGetter<EssentialTile>) {
  const nodeDefStore = useNodeDefStore()
  return computed(() =>
    resolveEssentialTileNodeDef(toValue(tile), nodeDefStore)
  )
}
