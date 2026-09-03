import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useNodeErrorFlagSync } from '@/composables/graph/useNodeErrorFlagSync'
import {
  getLiftedErrorSource,
  liftNodeErrorsToBoundary,
  resolveLiftChain
} from '@/core/graph/subgraph/liftNodeErrorsToBoundary'
import type { LGraphNode, LGraph } from '@/lib/litegraph/src/litegraph'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'
import type {
  ExecutionErrorWsMessage,
  NodeError,
  PromptError
} from '@/schemas/apiSchema'
import {
  getAncestorExecutionIds,
  tryNormalizeNodeExecutionId
} from '@/types/nodeIdentification'
import type { NodeExecutionId, NodeLocatorId } from '@/types/nodeIdentification'
import {
  executionIdToNodeLocatorId,
  getExecutionIdByNode,
  getNodeByExecutionId
} from '@/utils/graphTraversalUtil'
import type { UUID } from '@/utils/uuid'
import { zeroUuid } from '@/utils/uuid'
import {
  SIMPLE_ERROR_TYPES,
  errorsForSlot,
  getInputConfigBounds,
  hasErrorForSlot,
  isValueStillOutOfRange
} from '@/utils/executionErrorUtil'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'

interface SlotNodeErrorClearTarget {
  executionId: NodeExecutionId
  slotName: string
  /** Interior targets validate against the bounds recorded on their errors. */
  useRecordedBounds?: boolean
}

interface RunErrorState {
  nodeErrors: Record<string, NodeError> | null
  executionError: ExecutionErrorWsMessage | null
  promptError: PromptError | null
}

/** Execution error state: node errors, runtime errors, prompt errors, and missing assets. */
export const useExecutionErrorStore = defineStore('executionError', () => {
  const workflowStore = useWorkflowStore()
  const canvasStore = useCanvasStore()
  const missingModelStore = useMissingModelStore()
  const missingNodesStore = useMissingNodesErrorStore()
  const missingMediaStore = useMissingMediaStore()

  /**
   * Run errors belong to the workflow that produced them, so they are parked
   * under its path and root graph id and follow that graph back into view
   * rather than being discarded when another workflow is loaded.
   */
  const runErrorsByWorkflow = ref(new Map<string, RunErrorState>())
  const activeRunErrorKey = ref<string | null>(`:${zeroUuid}`)
  const isErrorOverlayOpen = ref(false)

  const activeRunErrors = computed<RunErrorState | undefined>(() =>
    activeRunErrorKey.value === null
      ? undefined
      : runErrorsByWorkflow.value.get(activeRunErrorKey.value)
  )

  const lastNodeErrors = computed(
    () => activeRunErrors.value?.nodeErrors ?? null
  )
  const lastExecutionError = computed(
    () => activeRunErrors.value?.executionError ?? null
  )
  const lastPromptError = computed(
    () => activeRunErrors.value?.promptError ?? null
  )

  function updateRunErrors(patch: Partial<RunErrorState>, key: string | null) {
    if (key === null) return

    const next: RunErrorState = {
      nodeErrors: null,
      executionError: null,
      promptError: null,
      ...runErrorsByWorkflow.value.get(key),
      ...patch
    }

    if (Object.values(next).every((value) => value === null)) {
      runErrorsByWorkflow.value.delete(key)
    } else {
      runErrorsByWorkflow.value.set(key, next)
    }
  }

  function runErrorKey(graphId: UUID, workflowPath?: string) {
    return `${workflowPath ?? workflowStore.activeWorkflow?.path ?? ''}:${graphId}`
  }

  function moveRunErrors(
    graphId: UUID,
    oldWorkflowPath: string,
    newWorkflowPath: string
  ) {
    const oldKey = runErrorKey(graphId, oldWorkflowPath)
    const newKey = runErrorKey(graphId, newWorkflowPath)
    if (oldKey === newKey) return

    const runErrors = runErrorsByWorkflow.value.get(oldKey)
    if (runErrors) runErrorsByWorkflow.value.set(newKey, runErrors)
    else runErrorsByWorkflow.value.delete(newKey)
    runErrorsByWorkflow.value.delete(oldKey)

    if (activeRunErrorKey.value === oldKey) {
      activeRunErrorKey.value = newKey
    }
  }

  function captureRunErrorKey() {
    return activeRunErrorKey.value
  }

  /**
   * Point the store at the run errors of `graphId`. `null` detaches it, so a
   * discarded graph shows nothing until the next one is loaded. The overlay is
   * dismissed on every move so it only ever reopens for the graph in front.
   */
  function setActiveGraph(graphId: UUID | null, workflowPath?: string) {
    const key = graphId === null ? null : runErrorKey(graphId, workflowPath)
    if (key === activeRunErrorKey.value) return
    activeRunErrorKey.value = key
    isErrorOverlayOpen.value = false
  }

  const pendingAddedNodeScans = new WeakMap<
    LGraph,
    Map<NodeExecutionId, number>
  >()
  const pendingAddedNodeScanRevision = ref(0)

  function beginAddedNodeErrorScan(
    rootGraph: LGraph,
    executionId: NodeExecutionId
  ): () => void {
    const scansForGraph = pendingAddedNodeScans.get(rootGraph) ?? new Map()
    scansForGraph.set(executionId, (scansForGraph.get(executionId) ?? 0) + 1)
    pendingAddedNodeScans.set(rootGraph, scansForGraph)
    pendingAddedNodeScanRevision.value++

    let finished = false
    return () => {
      if (finished) return
      finished = true

      const remaining = (scansForGraph.get(executionId) ?? 1) - 1
      if (remaining > 0) scansForGraph.set(executionId, remaining)
      else scansForGraph.delete(executionId)
      pendingAddedNodeScanRevision.value++
    }
  }

  function hasPendingAddedNodeErrorScan(
    rootGraph: LGraph,
    executionId: NodeExecutionId
  ): boolean {
    // Subscribe callers to changes in the non-reactive WeakMap.
    void pendingAddedNodeScanRevision.value
    return (pendingAddedNodeScans.get(rootGraph)?.get(executionId) ?? 0) > 0
  }

  /**
   * Replaces the full record; empty or null means the run produced no errors.
   *
   * `key` files the errors against the workflow that produced them, which is
   * not necessarily the one on screen. Build it with `runErrorKey`. It defaults
   * to the visible workflow for callers that record synchronously while
   * submitting it.
   */
  function recordNodeErrors(
    nodeErrors: Record<string, NodeError> | null,
    key: string | null = activeRunErrorKey.value
  ) {
    updateRunErrors(
      {
        nodeErrors:
          nodeErrors && Object.keys(nodeErrors).length > 0 ? nodeErrors : null
      },
      key
    )
  }

  function recordExecutionError(
    detail: ExecutionErrorWsMessage,
    key: string | null = activeRunErrorKey.value
  ) {
    updateRunErrors({ executionError: detail }, key)
  }

  function showExecutionError(
    detail: ExecutionErrorWsMessage,
    key: string | null = activeRunErrorKey.value
  ) {
    if (key === null || key !== activeRunErrorKey.value) return

    if (useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')) {
      showErrorOverlay()
    } else {
      useDialogService().showExecutionErrorDialog(detail)
    }
  }

  function recordPromptError(
    promptError: PromptError,
    key: string | null = activeRunErrorKey.value
  ) {
    updateRunErrors({ promptError }, key)
  }

  function showErrorOverlay() {
    isErrorOverlayOpen.value = true
  }

  function dismissErrorOverlay() {
    isErrorOverlayOpen.value = false
  }

  /** Clear error state produced by a run. Missing-resource state describes the
   *  loaded graph rather than the run, so only replacing or discarding the
   *  graph invalidates it. */
  function clearRunErrors() {
    if (activeRunErrorKey.value !== null) {
      runErrorsByWorkflow.value.delete(activeRunErrorKey.value)
    }
    isErrorOverlayOpen.value = false
  }

  function clearExecutionStartErrors(
    key: string | null = activeRunErrorKey.value
  ) {
    updateRunErrors({ executionError: null, promptError: null }, key)
    if (key === activeRunErrorKey.value && !lastNodeErrors.value) {
      isErrorOverlayOpen.value = false
    }
  }

  /** Clear only prompt-level errors. Called during resetExecutionState. */
  function clearPromptError(key: string | null = activeRunErrorKey.value) {
    updateRunErrors({ promptError: null }, key)
  }

  function clearSimpleNodeErrorsFromRecord(
    nodeErrors: Record<string, NodeError>,
    executionId: NodeExecutionId,
    slotName?: string
  ): Record<string, NodeError> | null {
    if (!(executionId in nodeErrors)) return null
    const nodeError = nodeErrors[executionId]

    const isSlotScoped = slotName !== undefined
    const relevantErrors = isSlotScoped
      ? errorsForSlot(nodeError.errors, slotName)
      : nodeError.errors

    if (relevantErrors.length === 0) return null
    if (!relevantErrors.every((e) => SIMPLE_ERROR_TYPES.has(e.type))) {
      return null
    }

    const updated = { ...nodeErrors }

    if (isSlotScoped) {
      const remainingErrors = nodeError.errors.filter(
        (error) => !relevantErrors.includes(error)
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
      delete updated[executionId]
    }

    return updated
  }

  /**
   * Raw interior sources of lifted errors whose boundary chain passes through
   * `(executionId, slotName)`, so a fix at any host level — final surface or
   * intermediate — clears the error at its raw key.
   */
  function getLiftedErrorSourceTargets(
    executionId: NodeExecutionId,
    slotName: string
  ): SlotNodeErrorClearTarget[] {
    const surfaced = surfacedNodeErrors.value
    if (!surfaced || !app.isGraphReady) return []

    return Object.values(surfaced).flatMap((surface) =>
      surface.errors.flatMap((error): SlotNodeErrorClearTarget[] => {
        const source = getLiftedErrorSource(error)
        if (!source) return []

        const sourceExecutionId = tryNormalizeNodeExecutionId(
          source.source_execution_id
        )
        if (!sourceExecutionId) return []

        const clearsThisError = resolveLiftChain(
          app.rootGraph,
          sourceExecutionId,
          source.source_input_name
        ).some(
          (level) =>
            level.hostExecId === executionId && level.hostInputName === slotName
        )
        return clearsThisError
          ? [
              {
                executionId: sourceExecutionId,
                slotName: source.source_input_name,
                useRecordedBounds: true
              }
            ]
          : []
      })
    )
  }

  /** Raw targets are keys into lastNodeErrors, not surfacedNodeErrors. */
  function getRawClearTargets(
    executionId: NodeExecutionId,
    slotName: string
  ): SlotNodeErrorClearTarget[] {
    return [
      { executionId, slotName },
      ...getLiftedErrorSourceTargets(executionId, slotName)
    ]
  }

  /**
   * Bounds recorded on the error win only for interior lifted targets, where
   * the caller's options describe the host widget rather than the interior
   * input. The base target keeps the caller's live widget bounds, which stay
   * authoritative when node definitions change after validation.
   */
  function getTargetRangeOptions(
    errors: NodeError['errors'],
    fallback: { min?: number; max?: number }
  ): { min?: number; max?: number } {
    for (const error of errors) {
      const { min, max } = getInputConfigBounds(error)
      if (min === undefined && max === undefined) continue
      return {
        min: typeof min === 'number' ? min : fallback.min,
        max: typeof max === 'number' ? max : fallback.max
      }
    }
    return fallback
  }

  function isTargetStillOutOfRange(
    nodeErrors: Record<string, NodeError>,
    target: SlotNodeErrorClearTarget,
    value: number,
    callerOptions: { min?: number; max?: number }
  ): boolean {
    if (!(target.executionId in nodeErrors)) return false
    const nodeError = nodeErrors[target.executionId]

    const errors = errorsForSlot(nodeError.errors, target.slotName)
    const options = target.useRecordedBounds
      ? getTargetRangeOptions(errors, callerOptions)
      : callerOptions

    return isValueStillOutOfRange(value, errors, options)
  }

  function clearTargets(
    targets: { executionId: NodeExecutionId; slotName?: string }[]
  ): void {
    if (!lastNodeErrors.value) return

    let updated = lastNodeErrors.value
    for (const target of targets) {
      updated =
        clearSimpleNodeErrorsFromRecord(
          updated,
          target.executionId,
          target.slotName
        ) ?? updated
    }

    if (updated === lastNodeErrors.value) return
    updateRunErrors(
      { nodeErrors: Object.keys(updated).length > 0 ? updated : null },
      activeRunErrorKey.value
    )
  }

  /**
   * Removes a node's errors if they consist entirely of simple, auto-resolvable
   * types. When `slotName` is provided, only errors for that slot are checked
   * and boundary-lifted errors are also cleared through their raw interior
   * source. Node-scoped calls (no `slotName`) operate on the raw record key
   * only.
   */
  function clearSimpleNodeErrors(
    executionId: NodeExecutionId,
    slotName?: string
  ): void {
    clearTargets(
      slotName === undefined
        ? [{ executionId }]
        : getRawClearTargets(executionId, slotName)
    )
  }

  /**
   * Attempts to clear an error for a given widget, but avoids clearing it if
   * the error is a range violation and the new value is still out of bounds.
   * The base target validates against the caller's live widget bounds; each
   * interior lifted target validates against its own recorded bounds, so a
   * boundary input fanning out to inputs with different constraints clears
   * only the targets the new value satisfies.
   *
   * Note: `value_not_in_list` errors are optimistically cleared without
   * list-membership validation because combo widgets constrain choices to
   * valid values at the UI level, and the valid-values source varies
   * (asset system vs objectInfo) making runtime validation non-trivial.
   */
  function clearSlotErrorsWithRangeCheck(
    executionId: NodeExecutionId,
    widgetName: string,
    newValue: unknown,
    options?: { min?: number; max?: number }
  ): void {
    const nodeErrors = lastNodeErrors.value
    if (!nodeErrors) return

    const targets = getRawClearTargets(executionId, widgetName)
    const clearableTargets =
      typeof newValue === 'number'
        ? targets.filter(
            (target) =>
              !isTargetStillOutOfRange(
                nodeErrors,
                target,
                newValue,
                options ?? {}
              )
          )
        : targets

    clearTargets(clearableTargets)
  }

  /**
   * Clears both validation errors and missing model state for a widget.
   *
   * @param errorInputName Name matched against `error.extra_info.input_name`.
   * @param widgetName Widget name used for missing model/media lookup.
   */
  function clearWidgetRelatedErrors(
    executionId: NodeExecutionId,
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
    return localId
  })

  const hasExecutionError = computed(() => !!lastExecutionError.value)

  const hasPromptError = computed(() => !!lastPromptError.value)

  const hasNodeError = computed(() => lastNodeErrors.value !== null)

  // Re-lifts only when the record changes; topology is assumed stable while errors are displayed.
  const surfacedNodeErrors = computed(() =>
    lastNodeErrors.value && app.isGraphReady
      ? liftNodeErrorsToBoundary(app.rootGraph, lastNodeErrors.value)
      : lastNodeErrors.value
  )

  const hasMissingError = computed(
    () =>
      missingNodesStore.hasMissingNodes ||
      missingModelStore.hasMissingModels ||
      missingMediaStore.hasMissingMedia
  )

  const hasAnyError = computed(
    () =>
      hasExecutionError.value ||
      hasPromptError.value ||
      hasNodeError.value ||
      hasMissingError.value
  )

  const allErrorExecutionIds = computed<string[]>(() => {
    const ids: string[] = []
    if (surfacedNodeErrors.value) {
      ids.push(...Object.keys(surfacedNodeErrors.value))
    }
    if (lastExecutionError.value) {
      const nodeId = lastExecutionError.value.node_id
      if (String(nodeId) !== '') {
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

    if (surfacedNodeErrors.value) {
      for (const executionId of Object.keys(surfacedNodeErrors.value)) {
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
      if (!surfacedNodeErrors.value) return {}

      const map: Record<NodeLocatorId, NodeError> = {}

      for (const [executionId, nodeError] of Object.entries(
        surfacedNodeErrors.value
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

    return hasErrorForSlot(nodeError.errors, slotName)
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

  useNodeErrorFlagSync(surfacedNodeErrors, missingModelStore, missingMediaStore)

  return {
    // Read-only state
    lastNodeErrors,
    lastExecutionError,
    lastPromptError,

    // Recording
    recordNodeErrors,
    recordExecutionError,
    recordPromptError,

    // Workflow scoping
    captureRunErrorKey,
    runErrorKey,
    moveRunErrors,
    setActiveGraph,

    // Clearing
    clearRunErrors,
    clearExecutionStartErrors,
    clearPromptError,

    // Overlay UI
    isErrorOverlayOpen,
    showExecutionError,
    showErrorOverlay,
    dismissErrorOverlay,

    // Derived state
    surfacedNodeErrors,
    hasExecutionError,
    hasPromptError,
    hasNodeError,
    hasMissingError,
    hasAnyError,
    allErrorExecutionIds,
    totalErrorCount,
    lastExecutionErrorNodeId,
    activeGraphErrorNodeIds,

    // Added-node scan coordination
    beginAddedNodeErrorScan,
    hasPendingAddedNodeErrorScan,

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
