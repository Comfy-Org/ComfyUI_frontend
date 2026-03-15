import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { st } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import type {
  ExecutionErrorWsMessage,
  NodeError,
  PromptError
} from '@/schemas/apiSchema'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  getAncestorExecutionIds,
  getParentExecutionIds
} from '@/types/nodeIdentification'
import type { NodeExecutionId, NodeLocatorId } from '@/types/nodeIdentification'
import type { MissingNodeType } from '@/types/comfy'
import {
  executionIdToNodeLocatorId,
  forEachNode,
  getNodeByExecutionId,
  getExecutionIdByNode,
  getActiveGraphNodeIds
} from '@/utils/graphTraversalUtil'
import {
  isValueStillOutOfRange,
  SIMPLE_ERROR_TYPES
} from '@/utils/executionErrorUtil'

interface MissingNodesError {
  message: string
  nodeTypes: MissingNodeType[]
}

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

/** Execution error state: node errors, runtime errors, prompt errors, and missing assets. */
export const useExecutionErrorStore = defineStore('executionError', () => {
  const workflowStore = useWorkflowStore()
  const canvasStore = useCanvasStore()

  const missingModelStore = useMissingModelStore()

  const lastNodeErrors = ref<Record<NodeId, NodeError> | null>(null)
  const lastExecutionError = ref<ExecutionErrorWsMessage | null>(null)
  const lastPromptError = ref<PromptError | null>(null)
  const missingNodesError = ref<MissingNodesError | null>(null)

  const isErrorOverlayOpen = ref(false)

  function showErrorOverlay() {
    isErrorOverlayOpen.value = true
  }

  function dismissErrorOverlay() {
    isErrorOverlayOpen.value = false
  }

  /** Clear all error state. Called at execution start and workflow changes.
   *  Missing model state is intentionally preserved here to avoid wiping
   *  in-progress model repairs (importTaskIds, URL inputs, etc.).
   *  Missing models are cleared separately during workflow load/clean paths. */
  function clearAllErrors() {
    lastExecutionError.value = null
    lastPromptError.value = null
    lastNodeErrors.value = null
    missingNodesError.value = null
    isErrorOverlayOpen.value = false
  }

  /** Clear only prompt-level errors. Called during resetExecutionState. */
  function clearPromptError() {
    lastPromptError.value = null
  }

  /**
   * Removes a node's errors if they consist entirely of simple, auto-resolvable
   * types. When `slotName` is provided, only errors for that slot are checked.
   */
  function clearSimpleNodeErrors(executionId: string, slotName?: string): void {
    if (!lastNodeErrors.value) return
    const nodeError = lastNodeErrors.value[executionId]
    if (!nodeError) return

    const isSlotScoped = slotName !== undefined

    const relevantErrors = isSlotScoped
      ? nodeError.errors.filter((e) => e.extra_info?.input_name === slotName)
      : nodeError.errors

    if (relevantErrors.length === 0) return
    if (!relevantErrors.every((e) => SIMPLE_ERROR_TYPES.has(e.type))) return

    const updated = { ...lastNodeErrors.value }

    if (isSlotScoped) {
      // Remove only the target slot's errors if they were all simple
      const remainingErrors = nodeError.errors.filter(
        (e) => e.extra_info?.input_name !== slotName
      )
      if (remainingErrors.length === 0) {
        delete updated[executionId]
      } else {
        updated[executionId] = {
          ...nodeError,
          errors: remainingErrors
        }
      }
    } else {
      // If no slot specified and all errors were simple, clear the whole node
      delete updated[executionId]
    }

    lastNodeErrors.value = Object.keys(updated).length > 0 ? updated : null
  }

  /**
   * Attempts to clear an error for a given widget, but avoids clearing it if
   * the error is a range violation and the new value is still out of bounds.
   *
   * Note: `value_not_in_list` errors are optimistically cleared without
   * list-membership validation because combo widgets constrain choices to
   * valid values at the UI level, and the valid-values source varies
   * (asset system vs objectInfo) making runtime validation non-trivial.
   */
  function clearSlotErrorsWithRangeCheck(
    executionId: string,
    widgetName: string,
    newValue: unknown,
    options?: { min?: number; max?: number }
  ): void {
    if (typeof newValue === 'number' && lastNodeErrors.value) {
      const nodeErrors = lastNodeErrors.value[executionId]
      if (nodeErrors) {
        const errs = nodeErrors.errors.filter(
          (e) => e.extra_info?.input_name === widgetName
        )
        if (isValueStillOutOfRange(newValue, errs, options || {})) return
      }
    }
    clearSimpleNodeErrors(executionId, widgetName)
  }

  /**
   * Clears both validation errors and missing model state for a widget.
   *
   * @param errorInputName Name matched against `error.extra_info.input_name`.
   *   For promoted subgraph widgets this is the subgraph input slot name
   *   (`widget.slotName`), which differs from the interior widget name.
   * @param widgetName The actual widget name, used for missing model lookup.
   *   At the legacy canvas call site both names are identical (`widget.name`).
   */
  function clearWidgetRelatedErrors(
    executionId: string,
    errorInputName: string,
    widgetName: string,
    newValue: unknown,
    options?: { min?: number; max?: number }
  ): void {
    clearSlotErrorsWithRangeCheck(
      executionId,
      errorInputName,
      newValue,
      options
    )
    missingModelStore.removeMissingModelByWidget(executionId, widgetName)
  }

  /** Set missing node types and open the error overlay if the Errors tab is enabled. */
  function surfaceMissingNodes(types: MissingNodeType[]) {
    setMissingNodeTypes(types)
    if (useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')) {
      showErrorOverlay()
    }
  }

  /** Set missing models and open the error overlay if the Errors tab is enabled. */
  function surfaceMissingModels(models: MissingModelCandidate[]) {
    missingModelStore.setMissingModels(models)
    if (
      models.length &&
      useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')
    ) {
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

  const lastExecutionErrorNodeLocatorId = computed(() => {
    const err = lastExecutionError.value
    if (!err) return null
    return executionIdToNodeLocatorId(app.rootGraph, String(err.node_id))
  })

  const lastExecutionErrorNodeId = computed(() => {
    const locator = lastExecutionErrorNodeLocatorId.value
    if (!locator) return null
    const localId = workflowStore.nodeLocatorIdToNodeId(locator)
    return localId != null ? String(localId) : null
  })

  const hasExecutionError = computed(() => !!lastExecutionError.value)

  const hasPromptError = computed(() => !!lastPromptError.value)

  const hasNodeError = computed(
    () => !!lastNodeErrors.value && Object.keys(lastNodeErrors.value).length > 0
  )

  const hasMissingNodes = computed(() => !!missingNodesError.value)

  const hasAnyError = computed(
    () =>
      hasExecutionError.value ||
      hasPromptError.value ||
      hasNodeError.value ||
      hasMissingNodes.value ||
      missingModelStore.hasMissingModels
  )

  const allErrorExecutionIds = computed<string[]>(() => {
    const ids: string[] = []
    if (lastNodeErrors.value) {
      ids.push(...Object.keys(lastNodeErrors.value))
    }
    if (lastExecutionError.value) {
      const nodeId = lastExecutionError.value.node_id
      if (nodeId !== null && nodeId !== undefined) {
        ids.push(String(nodeId))
      }
    }
    return ids
  })

  const promptErrorCount = computed(() => (lastPromptError.value ? 1 : 0))

  const nodeErrorCount = computed(() => {
    if (!lastNodeErrors.value) return 0
    let count = 0
    for (const nodeError of Object.values(lastNodeErrors.value)) {
      count += nodeError.errors.length
    }
    return count
  })

  const executionErrorCount = computed(() => (lastExecutionError.value ? 1 : 0))

  const missingNodeCount = computed(() => (missingNodesError.value ? 1 : 0))

  const totalErrorCount = computed(
    () =>
      promptErrorCount.value +
      nodeErrorCount.value +
      executionErrorCount.value +
      missingNodeCount.value +
      missingModelStore.missingModelCount
  )

  /** Graph node IDs (as strings) that have errors in the current graph scope. */
  const activeGraphErrorNodeIds = computed<Set<string>>(() => {
    const ids = new Set<string>()
    if (!app.isGraphReady) return ids

    // Fall back to rootGraph when currentGraph hasn't been initialized yet
    const activeGraph = canvasStore.currentGraph ?? app.rootGraph

    if (lastNodeErrors.value) {
      for (const executionId of Object.keys(lastNodeErrors.value)) {
        const graphNode = getNodeByExecutionId(app.rootGraph, executionId)
        if (graphNode?.graph === activeGraph) {
          ids.add(String(graphNode.id))
        }
      }
    }

    if (lastExecutionError.value) {
      const execNodeId = String(lastExecutionError.value.node_id)
      const graphNode = getNodeByExecutionId(app.rootGraph, execNodeId)
      if (graphNode?.graph === activeGraph) {
        ids.add(String(graphNode.id))
      }
    }

    return ids
  })

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

  /** Map of node errors indexed by locator ID. */
  const nodeErrorsByLocatorId = computed<Record<NodeLocatorId, NodeError>>(
    () => {
      if (!lastNodeErrors.value) return {}

      const map: Record<NodeLocatorId, NodeError> = {}

      for (const [executionId, nodeError] of Object.entries(
        lastNodeErrors.value
      )) {
        const locatorId = executionIdToNodeLocatorId(app.rootGraph, executionId)
        if (locatorId) {
          map[locatorId] = nodeError
        }
      }

      return map
    }
  )

  /** Get node errors by locator ID. */
  const getNodeErrors = (
    nodeLocatorId: NodeLocatorId
  ): NodeError | undefined => {
    return nodeErrorsByLocatorId.value[nodeLocatorId]
  }

  /** Check if a specific slot has validation errors. */
  const slotHasError = (
    nodeLocatorId: NodeLocatorId,
    slotName: string
  ): boolean => {
    const nodeError = getNodeErrors(nodeLocatorId)
    if (!nodeError) return false

    return nodeError.errors.some((e) => e.extra_info?.input_name === slotName)
  }

  /**
   * Set of all execution ID prefixes derived from active error nodes,
   * including the error nodes themselves.
   *
   * Example: error at "65:70:63" → Set { "65", "65:70", "65:70:63" }
   */
  const errorAncestorExecutionIds = computed<Set<NodeExecutionId>>(() => {
    const ids = new Set<NodeExecutionId>()
    for (const executionId of allErrorExecutionIds.value) {
      for (const id of getAncestorExecutionIds(executionId)) {
        ids.add(id)
      }
    }
    return ids
  })

  /** True if the node has errors inside it at any nesting depth. */
  function isContainerWithInternalError(node: LGraphNode): boolean {
    if (!app.isGraphReady) return false
    const execId = getExecutionIdByNode(app.rootGraph, node)
    if (!execId) return false
    return errorAncestorExecutionIds.value.has(execId)
  }

  /** True if the node has a missing node inside it at any nesting depth. */
  function isContainerWithMissingNode(node: LGraphNode): boolean {
    if (!app.isGraphReady) return false
    const execId = getExecutionIdByNode(app.rootGraph, node)
    if (!execId) return false
    return missingAncestorExecutionIds.value.has(execId)
  }

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

  return {
    // Raw state
    lastNodeErrors,
    lastExecutionError,
    lastPromptError,
    missingNodesError,

    // Clearing
    clearAllErrors,
    clearPromptError,

    // Overlay UI
    isErrorOverlayOpen,
    showErrorOverlay,
    dismissErrorOverlay,

    // Derived state
    hasExecutionError,
    hasPromptError,
    hasNodeError,
    hasMissingNodes,
    hasAnyError,
    allErrorExecutionIds,
    totalErrorCount,
    lastExecutionErrorNodeId,
    activeGraphErrorNodeIds,
    activeMissingNodeGraphIds,

    // Clearing (targeted)
    clearSimpleNodeErrors,
    clearWidgetRelatedErrors,

    // Missing node actions
    setMissingNodeTypes,
    surfaceMissingNodes,
    removeMissingNodesByType,

    // Missing model coordination (delegates to missingModelStore)
    surfaceMissingModels,

    // Lookup helpers
    getNodeErrors,
    slotHasError,
    isContainerWithInternalError,
    isContainerWithMissingNode
  }
})
