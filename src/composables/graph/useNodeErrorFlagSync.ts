import type { Ref } from 'vue'
import { watch } from 'vue'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
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
 * Single-pass reconciliation of node error flags.
 * Collects the set of nodes that should have errors, then walks all nodes
 * once, setting each flag exactly once. This avoids the redundant
 * true→false→true transition (and duplicate events) that a clear-then-apply
 * approach would cause.
 */
function reconcileNodeErrorFlags(
  rootGraph: LGraph,
  nodeErrors: Record<string, NodeError> | null,
  missingModelExecIds: Set<string>
): void {
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

  for (const execId of missingModelExecIds) {
    const node = getNodeByExecutionId(rootGraph, execId)
    if (node) flaggedNodes.add(node)
  }

  forEachNode(rootGraph, (node) => {
    setNodeHasErrors(node, flaggedNodes.has(node))

    if (node.inputs) {
      const nodeSlotNames = errorSlots.get(node)
      for (const slot of node.inputs) {
        slot.hasErrors = !!nodeSlotNames?.has(slot.name)
      }
    }
  })
}

export function useNodeErrorFlagSync(
  lastNodeErrors: Ref<Record<string, NodeError> | null>,
  missingModelStore: ReturnType<typeof useMissingModelStore>
): void {
  watch(
    [lastNodeErrors, () => missingModelStore.missingModelNodeIds],
    () => {
      if (!app.isGraphReady) return
      // Legacy (LGraphNode) only: suppress missing-model error flags when
      // the Errors tab is hidden, since legacy nodes lack the per-widget
      // red highlight that Vue nodes use to indicate *why* a node has errors.
      // Vue nodes compute hasAnyError independently and are unaffected.
      const showErrorsTab = useSettingStore().get(
        'Comfy.RightSidePanel.ShowErrorsTab'
      )
      reconcileNodeErrorFlags(
        app.rootGraph,
        lastNodeErrors.value,
        showErrorsTab
          ? missingModelStore.missingModelAncestorExecutionIds
          : new Set()
      )
    },
    { flush: 'post' }
  )
}
