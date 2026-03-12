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

interface MissingNodesError {
  message: string
  nodeTypes: MissingNodeType[]
}

function reconcileNodeErrorFlags(
  rootGraph: LGraph,
  nodeErrors: Record<NodeId, NodeError> | null
): void {
  const errorNodeIds = new Set<LGraphNode>()
  const errorSlotNames = new Map<LGraphNode, Set<string>>()

  if (nodeErrors) {
    for (const [executionId, nodeError] of Object.entries(nodeErrors)) {
      const node = getNodeByExecutionId(rootGraph, executionId)
      if (!node) continue

      errorNodeIds.add(node)

      for (const error of nodeError.errors) {
        const slotName = error.extra_info?.input_name
        if (!slotName) continue
        let slots = errorSlotNames.get(node)
        if (!slots) {
          slots = new Set()
          errorSlotNames.set(node, slots)
        }
        slots.add(slotName)
      }

      for (const parentId of getParentExecutionIds(executionId)) {
        const parentNode = getNodeByExecutionId(rootGraph, parentId)
        if (parentNode) errorNodeIds.add(parentNode)
      }
    }
  }

  forEachNode(rootGraph, (node) => {
    const shouldHaveErrors = errorNodeIds.has(node)
    if (node.has_errors !== shouldHaveErrors) {
      node.has_errors = shouldHaveErrors
    }

    if (node.inputs) {
      const slotNames = errorSlotNames.get(node)
      for (const slot of node.inputs) {
        const shouldSlotHaveErrors = !!slotNames?.has(slot.name)
        if (slot.hasErrors !== shouldSlotHaveErrors) {
          slot.hasErrors = shouldSlotHaveErrors
        }
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

  watch(lastNodeErrors, () => {
    if (!app.isGraphReady) return
    reconcileNodeErrorFlags(app.rootGraph, lastNodeErrors.value)
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
