import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { EssentialTile } from '@/constants/essentialsNodes'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { BLUEPRINT_TYPE_PREFIX } from '@/utils/blueprintUtils'

const defsByDisplayName = computed(() => {
  const nodeDefStore = useNodeDefStore()
  return Object.fromEntries(
    nodeDefStore.nodeDefs.map((def) => [def.display_name, def])
  )
})

export function resolveEssentialTileNodeDef(
  tile: EssentialTile,
  nodeDefStore: ReturnType<typeof useNodeDefStore>
): ComfyNodeDefImpl | undefined {
  const name = tile.nodeName
  if (!name) return undefined
  const byName = nodeDefStore.allNodeDefsByName[name]
  if (byName) return byName
  const target = name.startsWith(BLUEPRINT_TYPE_PREFIX)
    ? name.slice(BLUEPRINT_TYPE_PREFIX.length)
    : name
  return defsByDisplayName.value[target]
}

export function useEssentialTileNodeDef(tile: MaybeRefOrGetter<EssentialTile>) {
  const nodeDefStore = useNodeDefStore()
  return computed(() =>
    resolveEssentialTileNodeDef(toValue(tile), nodeDefStore)
  )
}
