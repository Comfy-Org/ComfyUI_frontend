import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { isGraphLoading } from '@/core/graph/graphLoadState'
import { st } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { isCloud } from '@/platform/distribution/types'
import { isMissingWarningVisible } from '@/platform/settings/missingWarningVisibility'
import { useSettingStore } from '@/platform/settings/settingStore'
import {
  dedupeMissingNodeTypes,
  removePendingMissingNodeTypesByExecutionIdPrefix,
  removePendingMissingNodeTypesByNodeId,
  updatePendingWarnings
} from '@/platform/workflow/core/utils/pendingWarnings'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useApp } from '@/scripts/appInstance'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import { getAncestorExecutionIds } from '@comfyorg/graph-model/nodeIdentification'
import type { NodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'
import { getExecutionIdByNode } from '@/utils/graphTraversalUtil'

interface MissingNodesError {
  message: string
  nodeTypes: MissingNodeType[]
}

export const useMissingNodesErrorStore = defineStore(
  'missingNodesError',
  () => {
    const missingNodesError = ref<MissingNodesError | null>(null)

    /** Error to display; `null` while the missing nodes warning is off. */
    const visibleMissingNodesError = computed(() =>
      isMissingWarningVisible('nodes') ? missingNodesError.value : null
    )

    function setMissingNodeTypes(types: MissingNodeType[]) {
      if (!types.length) {
        missingNodesError.value = null
        return
      }
      const uniqueTypes = dedupeMissingNodeTypes(types)
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

    /** Set missing node types. Returns true if the Errors tab and the missing nodes warning are enabled and types were set. */
    function surfaceMissingNodes(types: MissingNodeType[]): boolean {
      setMissingNodeTypes(types)
      return (
        hasMissingNodes.value &&
        useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')
      )
    }

    function removeMissingNodes(
      remove: (
        types: readonly MissingNodeType[] | undefined
      ) => MissingNodeType[]
    ) {
      const workflow = useWorkflowStore().activeWorkflow
      const pending = workflow?.pendingWarnings?.missingNodeTypes
      if (pending && !isGraphLoading(useApp().rootGraphOrUndefined)) {
        updatePendingWarnings(workflow, { missingNodeTypes: remove(pending) })
      }
      if (!missingNodesError.value) return
      setMissingNodeTypes(remove(missingNodesError.value.nodeTypes))
    }

    function removeMissingNodesByNodeId(nodeId: string) {
      removeMissingNodes((types) =>
        removePendingMissingNodeTypesByNodeId(types, nodeId)
      )
    }

    function removeMissingNodesByPrefix(prefix: string) {
      removeMissingNodes((types) =>
        removePendingMissingNodeTypesByExecutionIdPrefix(types, prefix)
      )
    }

    const hasMissingNodes = computed(() => !!visibleMissingNodesError.value)

    const missingNodeCount = computed(
      () => visibleMissingNodesError.value?.nodeTypes.length ?? 0
    )

    /**
     * Set of all execution ID prefixes derived from missing node execution IDs,
     * including the missing nodes themselves.
     *
     * Example: missing node at "65:70:63" → Set { "65", "65:70", "65:70:63" }
     */
    const missingAncestorExecutionIds = computed<Set<NodeExecutionId>>(() => {
      const ids = new Set<NodeExecutionId>()
      const error = visibleMissingNodesError.value
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
      if (!useApp().isGraphReady) return false
      const execId = getExecutionIdByNode(useApp().rootGraph, node)
      if (!execId) return false
      return missingAncestorExecutionIds.value.has(execId)
    }

    return {
      missingNodesError,
      visibleMissingNodesError,
      setMissingNodeTypes,
      surfaceMissingNodes,
      removeMissingNodesByNodeId,
      removeMissingNodesByPrefix,
      hasMissingNodes,
      missingNodeCount,
      missingAncestorExecutionIds,
      isContainerWithMissingNode
    }
  }
)
