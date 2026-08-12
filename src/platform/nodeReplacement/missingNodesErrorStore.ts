import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { st } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { replacePendingMissingNodeTypes } from '@/platform/workflow/core/utils/pendingWarnings'
import { app } from '@/scripts/app'
import type { MissingNodeType } from '@/types/comfy'
import { getAncestorExecutionIds } from '@/types/nodeIdentification'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { getExecutionIdByNode } from '@/utils/graphTraversalUtil'

interface MissingNodesError {
  message: string
  nodeTypes: MissingNodeType[]
}

/** Missing-node display state is projected from the active workflow's pending warnings. */
export const useMissingNodesErrorStore = defineStore(
  'missingNodesError',
  () => {
    const missingNodesError = ref<MissingNodesError | null>(null)

    function setMissingNodeTypes(types: MissingNodeType[]) {
      if (!types.length) {
        missingNodesError.value = null
        return
      }
      const uniqueTypes = replacePendingMissingNodeTypes(types)
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

    /** Set missing node types. Returns true if the Errors tab is enabled and types were set. */
    function surfaceMissingNodes(types: MissingNodeType[]): boolean {
      setMissingNodeTypes(types)
      return (
        types.length > 0 &&
        useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')
      )
    }

    const hasMissingNodes = computed(() => !!missingNodesError.value)

    const missingNodeCount = computed(
      () => missingNodesError.value?.nodeTypes.length ?? 0
    )

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
      hasMissingNodes,
      missingNodeCount,
      missingAncestorExecutionIds,
      isContainerWithMissingNode
    }
  }
)
