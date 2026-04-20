import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useNodeErrorFlagSync } from '@/composables/graph/useNodeErrorFlagSync'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import type {
  ExecutionErrorWsMessage,
  NodeError,
  PromptError
} from '@/schemas/apiSchema'
import { getAncestorExecutionIds } from '@/types/nodeIdentification'
import type { NodeExecutionId, NodeLocatorId } from '@/types/nodeIdentification'
import {
  executionIdToNodeLocatorId,
  getExecutionIdByNode,
  getNodeByExecutionId
} from '@/utils/graphTraversalUtil'
import {
  SIMPLE_ERROR_TYPES,
  isValueStillOutOfRange
} from '@/utils/executionErrorUtil'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'

/** Execution error state: node errors, runtime errors, prompt errors, and missing assets. */
export const useExecutionErrorStore = defineStore('executionError', () => {
  const workflowStore = useWorkflowStore()
  const canvasStore = useCanvasStore()
  const missingModelStore = useMissingModelStore()
  const missingNodesStore = useMissingNodesErrorStore()
  const missingMediaStore = useMissingMediaStore()

  const lastNodeErrors = ref<Record<NodeId, NodeError> | null>(null)
  const lastExecutionError = ref<ExecutionErrorWsMessage | null>(null)
  const lastPromptError = ref<PromptError | null>(null)

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
    missingNodesStore.setMissingNodeTypes([])
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
    missingMediaStore.removeMissingMediaByWidget(executionId, widgetName)
  }

  /** Set missing models and optionally open the error overlay. */
  function surfaceMissingModels(
    models: MissingModelCandidate[],
    options?: { silent?: boolean }
  ) {
    missingModelStore.setMissingModels(models)
    if (
      !options?.silent &&
      models.length &&
      useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')
    ) {
      showErrorOverlay()
    }
  }

  /** Set missing media and optionally open the error overlay. */
  function surfaceMissingMedia(
    media: MissingMediaCandidate[],
    options?: { silent?: boolean }
  ) {
    missingMediaStore.setMissingMedia(media)
    if (
      !options?.silent &&
      media.length &&
      useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')
    ) {
      showErrorOverlay()
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

  const hasAnyError = computed(
    () =>
      hasExecutionError.value ||
      hasPromptError.value ||
      hasNodeError.value ||
      missingNodesStore.hasMissingNodes ||
      missingModelStore.hasMissingModels ||
      missingMediaStore.hasMissingMedia
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

  const totalErrorCount = computed(
    () =>
      promptErrorCount.value +
      nodeErrorCount.value +
      executionErrorCount.value +
      missingNodesStore.missingNodeCount +
      missingModelStore.missingModelCount +
      missingMediaStore.missingMediaCount
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

  useNodeErrorFlagSync(lastNodeErrors, missingModelStore, missingMediaStore)

  return {
    // Raw state
    lastNodeErrors,
    lastExecutionError,
    lastPromptError,

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
    hasAnyError,
    allErrorExecutionIds,
    totalErrorCount,
    lastExecutionErrorNodeId,
    activeGraphErrorNodeIds,

    // Clearing (targeted)
    clearSimpleNodeErrors,
    clearWidgetRelatedErrors,

    // Missing model coordination (delegates to missingModelStore)
    surfaceMissingModels,

    // Missing media coordination (delegates to missingMediaStore)
    surfaceMissingMedia,

    // Lookup helpers
    getNodeErrors,
    slotHasError,
    isContainerWithInternalError
  }
})
