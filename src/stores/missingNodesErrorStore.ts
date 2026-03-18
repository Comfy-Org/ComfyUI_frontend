import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { st } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import type { MissingNodeType } from '@/types/comfy'
import { getAncestorExecutionIds } from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import {
  getActiveGraphNodeIds,
  getExecutionIdByNode
} from '@/utils/graphTraversalUtil'

interface MissingNodesError {
  message: string
  nodeTypes: MissingNodeType[]
}

export const useMissingNodesErrorStore = defineStore(
  'missingNodesError',
  () => {
    const canvasStore = useCanvasStore()

    const missingNodesError = ref<MissingNodesError | null>(null)

    function setMissingNodeTypes(types: MissingNodeType[]) {
      if (!types.length) {
        missingNodesError.value = null
        return
      }
      const seen = new Set<string>()
      const uniqueTypes = types.filter((node) => {
        // For string entries (group nodes), deduplicate by the string itself.
        // For object entries, prefer nodeId so multiple instances of the same
        // type are kept as separate rows; fall back to type if nodeId is absent.
        const isString = typeof node === 'string'
        let key: string
        if (isString) {
          key = node
        } else if (node.nodeId != null) {
          key = String(node.nodeId)
        } else {
          key = node.type
        }
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      missingNodesError.value = {
        message: isCloud
          ? st(
              'rightSidePanel.missingNodePacks.unsupportedTitle',
              'Unsupported Node Packs'
            )
          : st('rightSidePanel.missingNodePacks.title', 'Missing Node Packs'),
        nodeTypes: uniqueTypes
      }
    }

    /** Set missing node types and open the error overlay if the Errors tab is enabled. */
    function surfaceMissingNodes(
      types: MissingNodeType[],
      showErrorOverlay: () => void
    ) {
      setMissingNodeTypes(types)
      if (useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')) {
        showErrorOverlay()
      }
    }

    /** Remove specific node types from the missing nodes list (e.g. after replacement). */
    function removeMissingNodesByType(typesToRemove: string[]) {
      if (!missingNodesError.value) return
      const removeSet = new Set(typesToRemove)
      const remaining = missingNodesError.value.nodeTypes.filter((node) => {
        const nodeType = typeof node === 'string' ? node : node.type
        return !removeSet.has(nodeType)
      })
      setMissingNodeTypes(remaining)
    }

    const hasMissingNodes = computed(() => !!missingNodesError.value)

    const missingNodeCount = computed(() => (missingNodesError.value ? 1 : 0))

    /**
     * Set of all execution ID prefixes derived from missing node execution IDs,
     * including the missing nodes themselves.
     *
     * Example: missing node at "65:70:63" → Set { "65", "65:70", "65:70:63" }
     */
    const missingAncestorExecutionIds = computed<Set<NodeExecutionId>>(() => {
      const ids = new Set<NodeExecutionId>()
      const error = missingNodesError.value
      if (!error) return ids

      for (const nodeType of error.nodeTypes) {
        if (typeof nodeType === 'string') continue
        if (nodeType.nodeId == null) continue
        for (const id of getAncestorExecutionIds(String(nodeType.nodeId))) {
          ids.add(id)
        }
      }

      return ids
    })

    const activeMissingNodeGraphIds = computed<Set<string>>(() => {
      if (!app.isGraphReady) return new Set()
      return getActiveGraphNodeIds(
        app.rootGraph,
        canvasStore.currentGraph ?? app.rootGraph,
        missingAncestorExecutionIds.value
      )
    })

    /** True if the node has a missing node inside it at any nesting depth. */
    function isContainerWithMissingNode(node: LGraphNode): boolean {
      if (!app.isGraphReady) return false
      const execId = getExecutionIdByNode(app.rootGraph, node)
      if (!execId) return false
      return missingAncestorExecutionIds.value.has(execId)
    }

    return {
      missingNodesError,
      setMissingNodeTypes,
      surfaceMissingNodes,
      removeMissingNodesByType,
      hasMissingNodes,
      missingNodeCount,
      missingAncestorExecutionIds,
      activeMissingNodeGraphIds,
      isContainerWithMissingNode
    }
  }
)
