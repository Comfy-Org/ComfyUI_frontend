import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { st } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import type {
  ExecutionErrorWsMessage,
  NodeError,
  PromptError
} from '@/schemas/apiSchema'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import {
  executionIdToNodeLocatorId,
  forEachNode,
  getNodeByExecutionId,
  getRootParentNode
} from '@/utils/graphTraversalUtil'
import type { MissingNodeType } from '@/types/comfy'

interface MissingNodesError {
  message: string
  nodeTypes: MissingNodeType[]
}

/**
 * Store dedicated to execution error state management.
 *
 * Extracted from executionStore to separate error-related concerns
 * (state, computed properties, graph flag propagation, overlay UI)
 * from execution flow management (progress, queuing, events).
 */
export const useExecutionErrorStore = defineStore('executionError', () => {
  const workflowStore = useWorkflowStore()
  const canvasStore = useCanvasStore()

  const lastNodeErrors = ref<Record<NodeId, NodeError> | null>(null)
  const lastExecutionError = ref<ExecutionErrorWsMessage | null>(null)
  const lastPromptError = ref<PromptError | null>(null)

  const isErrorOverlayOpen = ref(false)

  // Missing node state (single error object or null)
  const missingNodesError = ref<MissingNodesError | null>(null)

  function showErrorOverlay() {
    isErrorOverlayOpen.value = true
  }

  function dismissErrorOverlay() {
    isErrorOverlayOpen.value = false
  }

  /** Clear all error state. Called at execution start. */
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

  /** Set missing node types detected during workflow load (deduplicated by nodeId, or by type for legacy string entries). */
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

  /** Whether a runtime execution error is present */
  const hasExecutionError = computed(() => !!lastExecutionError.value)

  /** Whether a prompt-level error is present (e.g. invalid_prompt, prompt_no_outputs) */
  const hasPromptError = computed(() => !!lastPromptError.value)

  /** Whether any node validation errors are present */
  const hasNodeError = computed(
    () => !!lastNodeErrors.value && Object.keys(lastNodeErrors.value).length > 0
  )

  /** Whether any missing node types are present in the current workflow */
  const hasMissingNodes = computed(() => !!missingNodesError.value)

  /** Whether any error (node validation, runtime execution, prompt-level, or missing nodes) is present */
  const hasAnyError = computed(
    () =>
      hasExecutionError.value ||
      hasPromptError.value ||
      hasNodeError.value ||
      hasMissingNodes.value
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

  /** Count of prompt-level errors (0 or 1) */
  const promptErrorCount = computed(() => (lastPromptError.value ? 1 : 0))

  /** Count of all individual node validation errors */
  const nodeErrorCount = computed(() => {
    if (!lastNodeErrors.value) return 0
    let count = 0
    for (const nodeError of Object.values(lastNodeErrors.value)) {
      count += nodeError.errors.length
    }
    return count
  })

  /** Count of runtime execution errors (0 or 1) */
  const executionErrorCount = computed(() => (lastExecutionError.value ? 1 : 0))

  /** Count of missing node errors (0 or 1 — all missing nodes are a single error group) */
  const missingNodeCount = computed(() => (missingNodesError.value ? 1 : 0))

  /** Total count of all individual errors */
  const totalErrorCount = computed(
    () =>
      promptErrorCount.value +
      nodeErrorCount.value +
      executionErrorCount.value +
      missingNodeCount.value
  )

  /** Pre-computed Set of graph node IDs (as strings) that have errors in the current graph scope. */
  const activeGraphErrorNodeIds = computed<Set<string>>(() => {
    const ids = new Set<string>()
    if (!app.rootGraph) return ids

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

  const activeMissingNodeGraphIds = computed<Set<string>>(() => {
    const ids = new Set<string>()
    const error = missingNodesError.value
    if (!error || !app.rootGraph) return ids

    const activeGraph = canvasStore.currentGraph ?? app.rootGraph

    for (const nodeType of error.nodeTypes) {
      if (typeof nodeType === 'string') continue
      if (nodeType.nodeId == null) continue
      const executionId = String(nodeType.nodeId)

      const graphNode = getNodeByExecutionId(app.rootGraph, executionId)
      if (graphNode?.graph === activeGraph) {
        ids.add(String(graphNode.id))
      }

      const rootParent = getRootParentNode(app.rootGraph, executionId)
      if (rootParent) {
        ids.add(String(rootParent.id))
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

  function hasInternalErrorForNode(nodeId: string | number): boolean {
    const prefix = `${nodeId}:`
    return allErrorExecutionIds.value.some((id) => id.startsWith(prefix))
  }

  /**
   * Update node and slot error flags when validation errors change.
   * Propagates errors up subgraph chains.
   */
  watch(lastNodeErrors, () => {
    if (!app.rootGraph) return

    // Clear all error flags
    forEachNode(app.rootGraph, (node) => {
      node.has_errors = false
      if (node.inputs) {
        for (const slot of node.inputs) {
          slot.hasErrors = false
        }
      }
    })

    if (!lastNodeErrors.value) return

    // Set error flags on nodes and slots
    for (const [executionId, nodeError] of Object.entries(
      lastNodeErrors.value
    )) {
      const node = getNodeByExecutionId(app.rootGraph, executionId)
      if (!node) continue

      node.has_errors = true

      // Mark input slots with errors
      if (node.inputs) {
        for (const error of nodeError.errors) {
          const slotName = error.extra_info?.input_name
          if (!slotName) continue

          const slot = node.inputs.find((s) => s.name === slotName)
          if (slot) {
            slot.hasErrors = true
          }
        }
      }

      // Propagate errors to parent subgraph nodes
      const parts = executionId.split(':')
      for (let i = parts.length - 1; i > 0; i--) {
        const parentExecutionId = parts.slice(0, i).join(':')
        const parentNode = getNodeByExecutionId(
          app.rootGraph,
          parentExecutionId
        )
        if (parentNode) {
          parentNode.has_errors = true
        }
      }
    }
  })

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

    // Missing node actions
    setMissingNodeTypes,

    // Lookup helpers
    getNodeErrors,
    slotHasError,
    hasInternalErrorForNode
  }
})
