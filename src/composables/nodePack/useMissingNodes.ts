import { LGraphNode } from '@comfyorg/litegraph'
import { NodeProperty } from '@comfyorg/litegraph/dist/LGraphNode'
import { groupBy } from 'lodash'
import { computed, onMounted } from 'vue'

import { useWorkflowPacks } from '@/composables/nodePack/useWorkflowPacks'
import { app } from '@/scripts/app'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { components } from '@/types/comfyRegistryTypes'

/**
 * Composable to find missing NodePacks from workflow
 * Uses the same filtering approach as ManagerDialogContent.vue
 * Automatically fetches workflow pack data when initialized
 */
export const useMissingNodes = () => {
  const nodeDefStore = useNodeDefStore()
  const comfyManagerStore = useComfyManagerStore()
  const { workflowPacks, isLoading, error, startFetchWorkflowPacks } =
    useWorkflowPacks()

  // Same filtering logic as ManagerDialogContent.vue
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
    const packId = node.properties?.cnr_id
    if (packId === undefined || !isCorePack(packId)) return false
    const nodeName = node.type
    const isRegisteredNodeDef = !!nodeDefStore.nodeDefsByName[nodeName]
    return !isRegisteredNodeDef
  }

  const missingCoreNodes = computed<Record<string, LGraphNode[]>>(() => {
    const missingNodes = app.graph.nodes.filter(isMissingCoreNode)
    return groupBy(missingNodes, (node) => String(node.properties?.ver || ''))
  })

  // Automatically fetch workflow pack data when composable is used
  onMounted(async () => {
    if (!workflowPacks.value.length && !isLoading.value) {
      await startFetchWorkflowPacks()
    }
  })

  return {
    missingNodePacks,
    missingCoreNodes,
    isLoading,
    error
  }
}
