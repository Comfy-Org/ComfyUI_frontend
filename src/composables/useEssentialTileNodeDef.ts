import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { EssentialTile } from '@/constants/essentialsNodes'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

// FIXME: Move all uses of SubgraphBlueprint to a shared source
const BLUEPRINT_PREFIX = 'SubgraphBlueprint.'

export function resolveEssentialTileNodeDef(
  tile: EssentialTile,
  nodeDefStore: ReturnType<typeof useNodeDefStore>
): ComfyNodeDefImpl | undefined {
  const name = tile.nodeName
  if (!name) return undefined
  const byName = nodeDefStore.allNodeDefsByName[name]
  if (byName) return byName
  const target = name.startsWith(BLUEPRINT_PREFIX)
    ? name.slice(BLUEPRINT_PREFIX.length)
    : name
  return nodeDefStore.nodeDefs.find((d) => d.display_name === target)
}

export function useEssentialTileNodeDef(
  title: MaybeRefOrGetter<EssentialTile>
) {
  const nodeDefStore = useNodeDefStore()
  return computed(() =>
    resolveEssentialTileNodeDef(toValue(title), nodeDefStore)
  )
}
