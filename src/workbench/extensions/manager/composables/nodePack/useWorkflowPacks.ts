import { createSharedComposable, whenever } from '@vueuse/core'
import { computed, onUnmounted, ref } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { app } from '@/scripts/app'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import type { components } from '@/types/comfyRegistryTypes'
import { mapAllNodes } from '@/utils/graphTraversalUtil'
import { useNodePacks } from '@/workbench/extensions/manager/composables/nodePack/useNodePacks'

export type WorkflowPack = {
  id: ComfyWorkflowJSON['nodes'][number]['properties']['cnr_id']

  version: ComfyWorkflowJSON['nodes'][number]['properties']['ver']
}

const CORE_NODES_PACK_NAME = 'comfy-core'

/**
 * Handles parsing node pack metadata from nodes on the graph and fetching the
 * associated node packs from the registry.
 * This is a shared singleton composable - all components use the same instance.
 */
const _useWorkflowPacks = () => {
  const nodeDefStore = useNodeDefStore()
  const systemStatsStore = useSystemStatsStore()
  const { inferPackFromNodeName } = useComfyRegistryStore()

  const workflowPacks = ref<WorkflowPack[]>([])
  const unresolvedNodeNames = ref<string[]>([])

  /** A fetch asked for before the graph existed, owed a retry once it does. */
  const fetchDeferredUntilGraphReady = ref(false)

  const getWorkflowNodePackId = (node: LGraphNode): string | undefined => {
    if (typeof node.properties.cnr_id === 'string') {
      return node.properties.cnr_id
    }
    if (typeof node.properties.aux_id === 'string') {
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
    if (nodeDef.isCoreNode) {
      if (!systemStatsStore.systemStats) {
        await systemStatsStore.refetchSystemStats()
      }
      return {
        id: CORE_NODES_PACK_NAME,
        version:
          systemStatsStore.systemStats?.system.comfyui_version ?? 'nightly'
      }
    }

    // Query the registry to find which pack provides this node
    const pack = await inferPackFromNodeName.call(nodeName)

    if (pack) {
      return {
        id: pack.id,
        version: pack.latest_version?.version ?? 'nightly'
      }
    }

    // No pack found - this node doesn't exist in the registry or couldn't be
    // extracted from the parent node pack successfully
    return undefined
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
   * Get the node packs for all nodes in the workflow (including subgraphs).
   * Nodes that have no local definition and no registry match are tracked
   * as unresolved so downstream consumers can surface them to the user.
   *
   * @returns `false` when the root graph does not exist yet and nothing was
   * parsed, so the caller can leave its state unready instead of publishing an
   * empty result as the workflow's answer.
   */
  const getWorkflowPacks = async () => {
    const rootGraph = app.rootGraphOrUndefined
    if (!rootGraph) return false

    const resolvedPacks: WorkflowPack[] = []
    const unresolved: string[] = []

    await Promise.all(
      mapAllNodes(rootGraph, async (node) => {
        const pack = await workflowNodeToPack(node)
        if (pack) {
          resolvedPacks.push(pack)
        }
      })
    )

    workflowPacks.value = resolvedPacks
    unresolvedNodeNames.value = [...new Set(unresolved)]
    return true
  }

  const packsToUniqueIds = (packs: WorkflowPack[]) =>
    packs.reduce((acc, pack) => {
      if (pack.id) acc.add(pack.id)
      return acc
    }, new Set<string>())

  const workflowPacksIds = computed(() =>
    Array.from(packsToUniqueIds(workflowPacks.value))
  )

  const { startFetch, cleanup, error, isLoading, nodePacks, isReady } =
    useNodePacks(workflowPacksIds)

  const isIdInWorkflow = (packId: string) =>
    workflowPacksIds.value.includes(packId)

  const filterWorkflowPack = (packs: components['schemas']['Node'][]) =>
    packs.filter((pack) => !!pack.id && isIdInWorkflow(pack.id))

  /**
   * Parse the workflow's packs, then fetch their registry info.
   *
   * Nothing runs while the root graph is still loading. Letting the fetch
   * through on an unready graph would resolve an empty pack-ID list and flip
   * `isReady` to true, which is terminal for both callers: the manager tab
   * trigger only fires while `!isReady`, and the missing-node trigger only
   * fires when the active workflow changes. CLOUD-FRONTEND-PROD-1YN proves the
   * active workflow can arrive before the graph, so an unready pass would
   * leave the Workflow and Missing tabs permanently empty for that workflow.
   */
  const startFetchWorkflowPacks = async () => {
    if (!(await getWorkflowPacks())) {
      fetchDeferredUntilGraphReady.value = true
      return
    }
    fetchDeferredUntilGraphReady.value = false
    await startFetch()
  }

  // Serve whatever was deferred as soon as the graph exists, so a fetch lost to
  // the startup race is not waiting on another workflow switch to come back.
  whenever(
    () => app.isGraphReady,
    () => {
      if (!fetchDeferredUntilGraphReady.value) return
      void startFetchWorkflowPacks()
    }
  )

  onUnmounted(() => {
    cleanup()
  })

  return {
    error,
    isLoading,
    isReady,
    workflowPacks: nodePacks,
    unresolvedNodeNames,
    startFetchWorkflowPacks,
    filterWorkflowPack
  }
}

export const useWorkflowPacks = createSharedComposable(_useWorkflowPacks)
