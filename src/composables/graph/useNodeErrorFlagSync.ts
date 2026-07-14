import type { Ref } from 'vue'
import { computed, watch } from 'vue'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import type { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import type { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import type { useDisabledPartnerNodesStore } from '@/platform/workspace/stores/disabledPartnerNodesStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
import type { NodeError } from '@/schemas/apiSchema'
import { getParentExecutionIds } from '@/types/nodeIdentification'
import { forEachNode, getNodeByExecutionId } from '@/utils/graphTraversalUtil'

function setNodeHasErrors(node: LGraphNode, hasErrors: boolean): void {
  if (node.has_errors === hasErrors) return
  const oldValue = node.has_errors
  node.has_errors = hasErrors
  node.graph?.trigger('node:property:changed', {
    type: 'node:property:changed',
    nodeId: node.id,
    property: 'has_errors',
    oldValue,
    newValue: hasErrors
  })
}

/**
 * Single-pass reconciliation of node error flags owned by error stores.
 * Flags set by other systems remain untouched.
 */
function reconcileNodeErrorFlags(
  rootGraph: LGraph,
  nodeErrors: Record<string, NodeError> | null,
  missingNodeExecIds: Set<string>,
  missingModelExecIds: Set<string>,
  missingMediaExecIds: Set<string> = new Set(),
  disabledNodeExecIds: Set<string> = new Set(),
  previouslyFlaggedNodes: Set<LGraphNode> = new Set(),
  previouslyFlaggedSlots: Map<LGraphNode, Set<string>> = new Map()
): {
  flaggedNodes: Set<LGraphNode>
  errorSlots: Map<LGraphNode, Set<string>>
} {
  // Collect nodes and slot info that should be flagged
  // Includes both error-owning nodes and their ancestor containers
  const flaggedNodes = new Set<LGraphNode>()
  const errorSlots = new Map<LGraphNode, Set<string>>()

  if (nodeErrors) {
    for (const [executionId, nodeError] of Object.entries(nodeErrors)) {
      const node = getNodeByExecutionId(rootGraph, executionId)
      if (!node) continue

      flaggedNodes.add(node)
      const slotNames = new Set<string>()
      for (const error of nodeError.errors) {
        const name = error.extra_info?.input_name
        if (name) slotNames.add(name)
      }
      if (slotNames.size > 0) errorSlots.set(node, slotNames)

      for (const parentId of getParentExecutionIds(executionId)) {
        const parentNode = getNodeByExecutionId(rootGraph, parentId)
        if (parentNode) flaggedNodes.add(parentNode)
      }
    }
  }

  for (const execId of missingNodeExecIds) {
    const node = getNodeByExecutionId(rootGraph, execId)
    if (node) flaggedNodes.add(node)
  }

  for (const execId of missingModelExecIds) {
    const node = getNodeByExecutionId(rootGraph, execId)
    if (node) flaggedNodes.add(node)
  }

  for (const execId of missingMediaExecIds) {
    const node = getNodeByExecutionId(rootGraph, execId)
    if (node) flaggedNodes.add(node)
  }

  for (const execId of disabledNodeExecIds) {
    const node = getNodeByExecutionId(rootGraph, execId)
    if (node) flaggedNodes.add(node)
  }

  forEachNode(rootGraph, (node) => {
    const isFlagged = flaggedNodes.has(node)
    if (isFlagged || previouslyFlaggedNodes.has(node)) {
      setNodeHasErrors(node, isFlagged)
    }

    if (node.inputs) {
      const nodeSlotNames = errorSlots.get(node)
      const previousSlotNames = previouslyFlaggedSlots.get(node)
      for (const slot of node.inputs) {
        const hasError = !!nodeSlotNames?.has(slot.name)
        if (hasError || previousSlotNames?.has(slot.name) || !slot.hasErrors) {
          slot.hasErrors = hasError
        }
      }
    }
  })

  return { flaggedNodes, errorSlots }
}

export function useNodeErrorFlagSync(
  nodeErrors: Ref<Record<string, NodeError> | null>,
  missingNodesStore: ReturnType<typeof useMissingNodesErrorStore>,
  missingModelStore: ReturnType<typeof useMissingModelStore>,
  missingMediaStore: ReturnType<typeof useMissingMediaStore>,
  disabledPartnerNodesStore: ReturnType<typeof useDisabledPartnerNodesStore>
): () => void {
  const settingStore = useSettingStore()
  const showErrorsTab = computed(() =>
    settingStore.get('Comfy.RightSidePanel.ShowErrorsTab')
  )
  let flaggedNodes = new Set<LGraphNode>()
  let errorSlots = new Map<LGraphNode, Set<string>>()

  const stop = watch(
    [
      nodeErrors,
      () => missingNodesStore.missingAncestorExecutionIds,
      () => missingModelStore.missingModelNodeIds,
      () => missingMediaStore.missingMediaNodeIds,
      () => disabledPartnerNodesStore.disabledAncestorExecutionIds,
      showErrorsTab
    ],
    () => {
      if (!app.isGraphReady) return
      // Legacy (LGraphNode) only: suppress missing-model/media error flags
      // when the Errors tab is hidden, since legacy nodes lack the per-widget
      // red highlight that Vue nodes use to indicate *why* a node has errors.
      // Vue nodes compute hasAnyError independently and are unaffected.
      const nextFlags = reconcileNodeErrorFlags(
        app.rootGraph,
        nodeErrors.value,
        missingNodesStore.missingAncestorExecutionIds,
        showErrorsTab.value
          ? missingModelStore.missingModelAncestorExecutionIds
          : new Set(),
        showErrorsTab.value
          ? missingMediaStore.missingMediaAncestorExecutionIds
          : new Set(),
        disabledPartnerNodesStore.disabledAncestorExecutionIds,
        flaggedNodes,
        errorSlots
      )
      flaggedNodes = nextFlags.flaggedNodes
      errorSlots = nextFlags.errorSlots
    },
    { flush: 'post' }
  )
  return stop
}
