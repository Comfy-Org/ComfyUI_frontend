import { groupBy } from 'es-toolkit/compat'
import { createSharedComposable, useEventListener } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { components } from '@/types/comfyRegistryTypes'
import { collectAllNodes } from '@/utils/graphTraversalUtil'
import { useWorkflowPacks } from '@/workbench/extensions/manager/composables/nodePack/useWorkflowPacks'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

/**
 * Composable to find missing NodePacks from workflow
 * Automatically fetches workflow pack data when initialized
 * This is a shared singleton composable - all components use the same instance
 */
export const useMissingNodes = createSharedComposable(() => {
  const nodeDefStore = useNodeDefStore()
  const comfyManagerStore = useComfyManagerStore()
  const workflowStore = useWorkflowStore()
  const {
    workflowPacks,
    unresolvedNodeNames,
    isLoading,
    error,
    startFetchWorkflowPacks
  } = useWorkflowPacks()

  const filterMissingPacks = (packs: components['schemas']['Node'][]) =>
    packs.filter((pack) => !comfyManagerStore.isPackInstalled(pack.id))

  // Filter only uninstalled packs from workflow packs
  const missingNodePacks = computed(() => {
    if (!workflowPacks.value.length) return []
    return filterMissingPacks(workflowPacks.value)
  })

  /**
   * Check if a pack is the ComfyUI builtin node pack (nodes that come pre-installed)
   * @param packId - The id of the pack to check
   * @returns True if the pack is the comfy-core pack, false otherwise
   */
  const isCorePack = (packId: NodeProperty) => {
    return packId === 'comfy-core'
  }

  /**
   * Check if a node is a missing core node
   * A missing core node is a node that is in the workflow and originates from
   * the comfy-core pack (pre-installed) but not registered in the node def
   * store (the node def was not found on the server)
   * @param node - The node to check
   * @returns True if the node is a missing core node, false otherwise
   */
  const isMissingCoreNode = (node: LGraphNode) => {
    const packId = node.properties.cnr_id
    if (packId === undefined || !isCorePack(packId)) return false
    const nodeName = node.type
    const isRegisteredNodeDef = !!nodeDefStore.nodeDefsByName[nodeName]
    return !isRegisteredNodeDef
  }

  /**
   * Bumped whenever the root graph's nodes are (re)configured. `LGraph.nodes`
   * isn't reactive on its own, and `rootGraphOrUndefined`'s underlying
   * `shallowRef` only changes identity once per page load (when
   * `ComfyApp.setup()` installs the graph), so without a dependency that
   * changes once the workflow's nodes actually arrive, the early return
   * below would make this computed's result freeze at `{}` after the single
   * recompute `setup()` triggers — the empty-graph snapshot — and never
   * report real missing core nodes for the session.
   */
  const graphConfiguredCount = ref(0)
  useEventListener(
    () => (app.isGraphReady ? app.rootGraph.events : undefined),
    'configured',
    () => {
      graphConfiguredCount.value++
    }
  )

  const missingCoreNodes = computed<Record<string, LGraphNode[]>>(() => {
    // Tracked unconditionally (before the early return) so this computed
    // recomputes once the workflow's nodes actually land, not just once an
    // (possibly empty) LGraph object exists.
    void graphConfiguredCount.value

    // Same unready-graph traversal as CLOUD-FRONTEND-PROD-1YN: `hasMissingNodes`
    // can be read before `ComfyApp.setup()` installs the graph, and `rootGraph`
    // force-casts `undefined` straight into the traversal.
    const rootGraph = app.rootGraphOrUndefined
    if (!rootGraph) return {}

    const missingNodes = collectAllNodes(rootGraph, isMissingCoreNode)
    return groupBy(missingNodes, (node) => String(node.properties.ver || ''))
  })

  // Check if workflow has any missing nodes
  const hasMissingNodes = computed(() => {
    return (
      missingNodePacks.value.length > 0 ||
      Object.keys(missingCoreNodes.value).length > 0 ||
      unresolvedNodeNames.value.length > 0
    )
  })

  // Re-fetch workflow packs when active workflow changes
  watch(
    () => workflowStore.activeWorkflow,
    async () => {
      await startFetchWorkflowPacks()
    },
    { immediate: true }
  )

  return {
    missingNodePacks,
    missingCoreNodes,
    unresolvedNodeNames,
    hasMissingNodes,
    isLoading,
    error
  }
})
