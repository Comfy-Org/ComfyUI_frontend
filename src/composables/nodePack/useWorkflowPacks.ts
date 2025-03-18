import { LGraphNode } from '@comfyorg/litegraph'
import { computed, onUnmounted } from 'vue'

import { useNodePacks } from '@/composables/nodePack/useNodePacks'
import { ComfyWorkflowJSON } from '@/schemas/comfyWorkflowSchema'
import { app } from '@/scripts/app'
import { UseNodePacksOptions } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

type WorkflowPack = {
  id:
    | ComfyWorkflowJSON['nodes'][number]['properties']['cnr_id']
    | ComfyWorkflowJSON['nodes'][number]['properties']['aux_id']
  version: ComfyWorkflowJSON['nodes'][number]['properties']['ver']
}

const CORE_NODES_PACK_NAME = 'comfy-core'

/**
 * Handles parsing node pack metadata from nodes on the graph and fetching the
 * associated node packs from the registry
 */
export const useWorkflowPacks = (options: UseNodePacksOptions = {}) => {
  const getWorkflowNodeId = (node: LGraphNode): string | undefined => {
    if (typeof node.properties?.cnr_id === 'string') {
      return node.properties.cnr_id
    }
    if (typeof node.properties?.aux_id === 'string') {
      return node.properties.aux_id
    }
    return undefined
  }

  const workflowNodeToPack = (node: LGraphNode): WorkflowPack | undefined => {
    const id = getWorkflowNodeId(node)
    if (!id) return undefined
    if (id === CORE_NODES_PACK_NAME) return undefined

    const version =
      typeof node.properties.ver === 'string' ? node.properties.ver : undefined

    return {
      id,
      version
    }
  }

  const workflowPacks = computed<WorkflowPack[]>(() => {
    if (!app.graph?.nodes?.length) return []
    return app.graph.nodes
      .map(workflowNodeToPack)
      .filter((pack) => pack !== undefined)
  })

  const packsToUniqueIds = (packs: WorkflowPack[]) =>
    packs.reduce((acc, pack) => {
      if (pack?.id) acc.add(pack.id)
      return acc
    }, new Set<string>())

  const workflowPacksIds = computed(() =>
    Array.from(packsToUniqueIds(workflowPacks.value))
  )

  const { startFetch, cleanup, error, isLoading, nodePacks } = useNodePacks(
    workflowPacksIds,
    options
  )

  const isIdInWorkflow = (packId: string) =>
    workflowPacksIds.value.includes(packId)

  const filterWorkflowPack = (packs: components['schemas']['Node'][]) =>
    packs.filter((pack) => !!pack.id && isIdInWorkflow(pack.id))

  onUnmounted(() => {
    cleanup()
  })

  return {
    error,
    isLoading,
    workflowPacks: nodePacks,
    startFetchWorkflowPacks: startFetch,
    filterWorkflowPack
  }
}
