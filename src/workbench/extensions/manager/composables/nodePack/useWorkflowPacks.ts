import { createSharedComposable, whenever } from '@vueuse/core'
import { computed, onUnmounted, ref } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
// `app.isGraphReady` is a plain getter on a non-reactive class instance, so
// it cannot drive a watcher by itself. `canvasStore.canvas` is the reactive
// signal that `GraphCanvas.vue` sets right after `comfyApp.setup()` resolves,
// by which point the root graph already exists (see AgentPanelRoot.vue for
// the same pattern).
// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
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
  const canvasStore = useCanvasStore()

  const workflowPacks = ref<WorkflowPack[]>([])
  const unresolvedNodeNames = ref<string[]>([])
  // Set when a fetch was requested before the root graph existed, so it can
  // be retried once the graph becomes ready instead of leaving the registry
  // fetch permanently "ready" with no packs resolved.
  const retryWhenGraphReady = ref(false)

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
   */
  const getWorkflowPacks = async (): Promise<boolean> => {
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

  const startFetchWorkflowPacks = async () => {
    const parsed = await getWorkflowPacks() // Parse the packs from the workflow nodes
    if (!parsed) {
      retryWhenGraphReady.value = true
      return
    }
    await startFetch() // Fetch the packs infos from the registry
  }

  whenever(
    () => retryWhenGraphReady.value && !!canvasStore.canvas && app.isGraphReady,
    () => {
      retryWhenGraphReady.value = false
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
