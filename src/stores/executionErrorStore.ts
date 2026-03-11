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
  getExecutionIdByNode
} from '@/utils/graphTraversalUtil'

interface MissingNodesError {
  message: string
  nodeTypes: MissingNodeType[]
}

function clearAllNodeErrorFlags(rootGraph: LGraph): void {
  forEachNode(rootGraph, (node) => {
    node.has_errors = false
    if (node.inputs) {
      for (const slot of node.inputs) {
        slot.hasErrors = false
      }
    }
  })
}

function markNodeSlotErrors(node: LGraphNode, nodeError: NodeError): void {
  if (!node.inputs) return
  for (const error of nodeError.errors) {
    const slotName = error.extra_info?.input_name
    if (!slotName) continue
    const slot = node.inputs.find((s) => s.name === slotName)
    if (slot) slot.hasErrors = true
  }
}

function applyNodeError(
  rootGraph: LGraph,
  executionId: NodeExecutionId,
  nodeError: NodeError
): void {
  const node = getNodeByExecutionId(rootGraph, executionId)
  if (!node) return

  node.has_errors = true
  markNodeSlotErrors(node, nodeError)

  for (const parentId of getParentExecutionIds(executionId)) {
    const parentNode = getNodeByExecutionId(rootGraph, parentId)
    if (parentNode) parentNode.has_errors = true
  }
}

/** Execution error state: node errors, runtime errors, prompt errors, and missing assets. */
export const useExecutionErrorStore = defineStore('executionError', () => {
  const workflowStore = useWorkflowStore()
  const canvasStore = useCanvasStore()

  const lastNodeErrors = ref<Record<NodeId, NodeError> | null>(null)
  const lastExecutionError = ref<ExecutionErrorWsMessage | null>(null)
  const lastPromptError = ref<PromptError | null>(null)
  const missingNodesError = ref<MissingNodesError | null>(null)
  const missingModelsError = ref<MissingModelCandidate[] | null>(null)

  const isErrorOverlayOpen = ref(false)

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
    missingModelsError.value = null
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
    missingModelsError.value = models.length ? models : null
    if (
      models.length &&
      useSettingStore().get('Comfy.RightSidePanel.ShowErrorsTab')
    ) {
      showErrorOverlay()
    }
  }

  /** Remove a single missing model by filename (e.g. after download completes). */
  function removeMissingModelByName(name: string) {
    if (!missingModelsError.value) return
    missingModelsError.value = missingModelsError.value.filter(
      (m) => m.name !== name
    )
    if (!missingModelsError.value.length) missingModelsError.value = null
  }

  /** Remove missing model entries whose nodeId is in the given set. */
  function removeMissingModelsByNodeIds(nodeIds: Set<string>) {
    if (!missingModelsError.value) return
    missingModelsError.value = missingModelsError.value.filter(
      (m) => !m.nodeId || !nodeIds.has(String(m.nodeId))
    )
    if (!missingModelsError.value.length) missingModelsError.value = null
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

  const hasMissingModels = computed(() => !!missingModelsError.value?.length)

  const hasAnyError = computed(
    () =>
      hasExecutionError.value ||
      hasPromptError.value ||
      hasNodeError.value ||
      hasMissingNodes.value ||
      hasMissingModels.value
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

  const missingModelCount = computed(
    () => missingModelsError.value?.length ?? 0
  )

  const totalErrorCount = computed(
    () =>
      promptErrorCount.value +
      nodeErrorCount.value +
      executionErrorCount.value +
      missingNodeCount.value +
      missingModelCount.value
  )

  const missingModelNodeIds = computed<Set<string>>(() => {
    const ids = new Set<string>()
    if (!missingModelsError.value) return ids
    for (const m of missingModelsError.value) {
      if (m.nodeId) ids.add(String(m.nodeId))
    }
    return ids
  })

  /**
   * Set of all execution ID prefixes derived from missing model node IDs,
   * including the missing model nodes themselves.
   *
   * Example: missing model on node "65:70:63" → Set { "65", "65:70", "65:70:63" }
   */
  const missingModelAncestorExecutionIds = computed<Set<NodeExecutionId>>(
    () => {
      const ids = new Set<NodeExecutionId>()
      for (const nodeId of missingModelNodeIds.value) {
        for (const id of getAncestorExecutionIds(nodeId)) {
          ids.add(id)
        }
      }
      return ids
    }
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
    const ids = new Set<string>()
    if (!app.isGraphReady) return ids

    const activeGraph = canvasStore.currentGraph ?? app.rootGraph

    for (const executionId of missingAncestorExecutionIds.value) {
      const graphNode = getNodeByExecutionId(app.rootGraph, executionId)
      if (graphNode?.graph === activeGraph) {
        ids.add(String(graphNode.id))
      }
    }

    return ids
  })

  const activeMissingModelGraphIds = computed<Set<string>>(() => {
    const ids = new Set<string>()
    if (!app.rootGraph) return ids

    const activeGraph = canvasStore.currentGraph ?? app.rootGraph

    for (const executionId of missingModelAncestorExecutionIds.value) {
      const graphNode = getNodeByExecutionId(app.rootGraph, executionId)
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

  /** True if the node has a missing node inside it at any nesting depth. */
  function isContainerWithMissingNode(node: LGraphNode): boolean {
    if (!app.isGraphReady) return false
    const execId = getExecutionIdByNode(app.rootGraph, node)
    if (!execId) return false
    return missingAncestorExecutionIds.value.has(execId)
  }

  /** True if the node has a missing model inside it at any nesting depth. */
  function isContainerWithMissingModel(node: LGraphNode): boolean {
    if (!app.rootGraph) return false
    const execId = getExecutionIdByNode(app.rootGraph, node)
    if (!execId) return false
    return missingModelAncestorExecutionIds.value.has(execId)
  }

  function hasMissingModelOnNode(nodeLocatorId: string): boolean {
    return missingModelNodeIds.value.has(nodeLocatorId)
  }

  function isWidgetMissingModel(nodeId: string, widgetName: string): boolean {
    if (!missingModelsError.value) return false
    return missingModelsError.value.some(
      (m) => String(m.nodeId) === nodeId && m.widgetName === widgetName
    )
  }

  watch(lastNodeErrors, () => {
    if (!app.isGraphReady) return
    const rootGraph = app.rootGraph

    clearAllNodeErrorFlags(rootGraph)

    if (!lastNodeErrors.value) return

    for (const [executionId, nodeError] of Object.entries(
      lastNodeErrors.value
    )) {
      applyNodeError(rootGraph, executionId, nodeError)
    }
  })

  return {
    // Raw state
    lastNodeErrors,
    lastExecutionError,
    lastPromptError,
    missingNodesError,
    missingModelsError,

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
    hasMissingModels,
    hasAnyError,
    allErrorExecutionIds,
    totalErrorCount,
    lastExecutionErrorNodeId,
    activeGraphErrorNodeIds,
    activeMissingNodeGraphIds,
    activeMissingModelGraphIds,

    // Missing node actions
    setMissingNodeTypes,
    surfaceMissingNodes,
    removeMissingNodesByType,

    // Missing model actions
    surfaceMissingModels,
    removeMissingModelByName,
    removeMissingModelsByNodeIds,

    // Lookup helpers
    getNodeErrors,
    slotHasError,
    isContainerWithInternalError,
    isContainerWithMissingNode,
    isContainerWithMissingModel,
    hasMissingModelOnNode,
    isWidgetMissingModel
  }
})
