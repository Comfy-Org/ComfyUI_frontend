import { LGraphNode } from '@comfyorg/litegraph'
import { computed, onUnmounted, ref } from 'vue'

import { useNodePacks } from '@/composables/nodePack/useNodePacks'
import { ComfyWorkflowJSON } from '@/schemas/comfyWorkflowSchema'
import { app } from '@/scripts/app'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { SelectedVersion, UseNodePacksOptions } from '@/types/comfyManagerTypes'
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
  const nodeDefStore = useNodeDefStore()
  const systemStatsStore = useSystemStatsStore()
  const { search } = useComfyRegistryStore()

  const workflowPacks = ref<WorkflowPack[]>([])

  const getWorkflowNodePackId = (node: LGraphNode): string | undefined => {
    if (typeof node.properties?.cnr_id === 'string') {
      return node.properties.cnr_id
    }
    if (typeof node.properties?.aux_id === 'string') {
      return node.properties.aux_id
    }
    return undefined
  }

  /**
   * Clean the version string to be used in the registry search.
   * Removes the leading 'v' and trims whitespace and line terminators.
   */
  const cleanVersionString = (version: string) =>
    version.replace(/^v/, '').trim()

  /**
   * Infer the pack for a node by searching the registry for packs that have nodes
   * with the same name.
   */
  const inferPack = async (
    node: LGraphNode
  ): Promise<WorkflowPack | undefined> => {
    const nodeName = node.type

    // Check if node is a core node
    const nodeDef = nodeDefStore.nodeDefsByName[nodeName]
    if (nodeDef?.nodeSource.type === 'core') {
      if (!systemStatsStore.systemStats) {
        await systemStatsStore.fetchSystemStats()
      }
      return {
        id: CORE_NODES_PACK_NAME,
        version:
          systemStatsStore.systemStats?.system?.comfyui_version ??
          SelectedVersion.NIGHTLY
      }
    }

    // Search the registry for non-core nodes
    const searchResult = await search.call({
      comfy_node_search: nodeName,
      limit: 1
    })
    if (searchResult?.nodes?.length) {
      const pack = searchResult.nodes[0]
      return {
        id: pack.id,
        version: pack.latest_version?.version ?? SelectedVersion.NIGHTLY
      }
    }
  }

  /**
   * Map a workflow node to its pack using the node pack metadata.
   * If the node pack metadata is not available, fallback to searching the
   * registry for packs that have nodes with the same name.
   */
  const workflowNodeToPack = async (
    node: LGraphNode
  ): Promise<WorkflowPack | undefined> => {
    const packId = getWorkflowNodePackId(node)
    if (!packId) return inferPack(node) // Fallback
    if (packId === CORE_NODES_PACK_NAME) return undefined

    const version =
      typeof node.properties.ver === 'string'
        ? cleanVersionString(node.properties.ver)
        : undefined

    return {
      id: packId,
      version
    }
  }

  /**
   * Get the node packs for all nodes in the workflow.
   */
  const getWorkflowPacks = async () => {
    if (!app.graph?.nodes?.length) return []
    const packs = await Promise.all(app.graph.nodes.map(workflowNodeToPack))
    workflowPacks.value = packs.filter((pack) => pack !== undefined)
  }

  const packsToUniqueIds = (packs: WorkflowPack[]) =>
    packs.reduce((acc, pack) => {
      if (pack?.id) acc.add(pack.id)
      return acc
    }, new Set<string>())

  const workflowPacksIds = computed(() =>
    Array.from(packsToUniqueIds(workflowPacks.value))
  )

  const { startFetch, cleanup, error, isLoading, nodePacks, isReady } =
    useNodePacks(workflowPacksIds, options)

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
    isReady,
    workflowPacks: nodePacks,
    startFetchWorkflowPacks: async () => {
      await getWorkflowPacks() // Parse the packs from the workflow nodes
      await startFetch() // Fetch the packs infos from the registry
    },
    filterWorkflowPack
  }
}
