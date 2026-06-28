/**
 * Installs per-node error-clearing callbacks (onConnectionsChange,
 * onWidgetChanged) on all current and future nodes in a graph.
 *
 * Decoupled from the Vue rendering lifecycle so that error auto-clearing
 * works in legacy canvas mode as well.
 */
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { clearWidgetRelatedErrorScopes } from '@/composables/graph/widgetErrorClearing'
import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  LGraphEventMode,
  NodeSlotType
} from '@/lib/litegraph/src/types/globalEnums'
import type { LGraphTriggerEvent } from '@/lib/litegraph/src/types/graphTriggers'
import { ChangeTracker } from '@/scripts/changeTracker'
import { isCloud } from '@/platform/distribution/types'
import { assetService } from '@/platform/assets/services/assetService'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import {
  scanNodeModelCandidates,
  verifyAssetSupportedCandidates
} from '@/platform/missingModel/missingModelScan'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import {
  scanNodeMediaCandidates,
  verifyMediaCandidates
} from '@/platform/missingMedia/missingMediaScan'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useNodeReplacementStore } from '@/platform/nodeReplacement/nodeReplacementStore'
import { getCnrIdFromNode } from '@/platform/nodeReplacement/cnrIdUtil'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import {
  collectAllNodes,
  getExecutionIdByNode,
  getExecutionIdForNodeInGraph,
  getNodeByExecutionId,
  isExecutionPathActive,
  isMissingCandidateActive
} from '@/utils/graphTraversalUtil'
import { getParentExecutionIds } from '@/types/nodeIdentification'

const hookedNodes = new WeakSet<LGraphNode>()

type OriginalCallbacks = {
  onConnectionsChange: LGraphNode['onConnectionsChange']
  onWidgetChanged: LGraphNode['onWidgetChanged']
}

const originalCallbacks = new WeakMap<LGraphNode, OriginalCallbacks>()

function getRemovedNodeExecutionId(graph: LGraph, nodeId: NodeId): string {
  if (!app.rootGraph) return String(nodeId)

  return (
    getExecutionIdForNodeInGraph(app.rootGraph, graph, nodeId) ?? String(nodeId)
  )
}

function installNodeHooks(node: LGraphNode): void {
  if (hookedNodes.has(node)) return
  hookedNodes.add(node)

  originalCallbacks.set(node, {
    onConnectionsChange: node.onConnectionsChange,
    onWidgetChanged: node.onWidgetChanged
  })

  node.onConnectionsChange = useChainCallback(
    node.onConnectionsChange,
    function (type, slotIndex, isConnected) {
      if (type !== NodeSlotType.INPUT || !isConnected) return
      if (!app.rootGraph) return
      const slotName = node.inputs?.[slotIndex]?.name
      if (!slotName) return
      const execId = getExecutionIdByNode(app.rootGraph, node)
      if (!execId) return
      useExecutionErrorStore().clearSimpleNodeErrors(execId, slotName)
    }
  )

  node.onWidgetChanged = useChainCallback(
    node.onWidgetChanged,
    function (name, newValue, _oldValue, widget) {
      if (!app.rootGraph) return
      const hostExecId = getExecutionIdByNode(app.rootGraph, node)
      if (!hostExecId) return

      const executionErrorStore = useExecutionErrorStore()
      const range = { min: widget.options?.min, max: widget.options?.max }
      const source = resolvePromotedWidgetSource(app.rootGraph, node, widget)
      clearWidgetRelatedErrorScopes({
        clearWidgetRelatedErrors: executionErrorStore.clearWidgetRelatedErrors,
        host: {
          executionId: hostExecId,
          errorInputName: name,
          widgetName: widget.name
        },
        source: source?.sourceExecutionId
          ? {
              executionId: source.sourceExecutionId,
              widgetName: source.sourceWidgetName
            }
          : undefined,
        value: newValue,
        range
      })
    }
  )
}

function restoreNodeHooks(node: LGraphNode): void {
  const originals = originalCallbacks.get(node)
  if (!originals) return
  node.onConnectionsChange = originals.onConnectionsChange
  node.onWidgetChanged = originals.onWidgetChanged
  originalCallbacks.delete(node)
  hookedNodes.delete(node)
}

function installNodeHooksRecursive(node: LGraphNode): void {
  installNodeHooks(node)
  if (node.isSubgraphNode?.()) {
    for (const innerNode of node.subgraph._nodes ?? []) {
      installNodeHooksRecursive(innerNode)
    }
  }
}

function restoreNodeHooksRecursive(node: LGraphNode): void {
  restoreNodeHooks(node)
  if (node.isSubgraphNode?.()) {
    for (const innerNode of node.subgraph._nodes ?? []) {
      restoreNodeHooksRecursive(innerNode)
    }
  }
}

function isNodeInactive(mode: number): boolean {
  return mode === LGraphEventMode.NEVER || mode === LGraphEventMode.BYPASS
}

function scanNodeErrorTargets(
  node: LGraphNode,
  scanNode: (node: LGraphNode) => void
): void {
  if (!app.rootGraph) return

  if (node.isSubgraphNode?.() && node.subgraph) {
    scanNode(node)
    for (const innerNode of collectAllNodes(node.subgraph)) {
      if (isNodeInactive(innerNode.mode)) continue
      scanNode(innerNode)
    }
    return
  }

  scanNode(node)
}

function getActiveExecutionId(node: LGraphNode): string | null {
  if (!app.rootGraph) return null
  // Skip when any enclosing subgraph is muted/bypassed. Callers only
  // verify each node's own mode; entering a bypassed subgraph (via
  // useGraphNodeManager replaying onNodeAdded for existing interior
  // nodes) reaches this point without the ancestor check. A null
  // execId means the node has no current graph (e.g. detached mid
  // lifecycle) — also skip, since we cannot verify its scope.
  const execId = getExecutionIdByNode(app.rootGraph, node)
  if (!execId || !isExecutionPathActive(app.rootGraph, execId)) return null
  return execId
}

/** Scan a single node and add confirmed missing model/media to stores.
 *  For subgraph containers, also scans all active interior nodes. */
function scanAndAddNodeErrors(node: LGraphNode): void {
  scanNodeErrorTargets(node, scanSingleNodeErrors)
}

function scanSingleNodeErrors(node: LGraphNode): void {
  scanSingleNodeModelsAndTypes(node)
  scanSingleNodeMedia(node)
}

function scanSingleNodeModelsAndTypes(node: LGraphNode): void {
  if (!app.rootGraph) return
  const execId = getActiveExecutionId(node)
  if (!execId) return

  const modelCandidates = scanNodeModelCandidates(
    app.rootGraph,
    node,
    isCloud
      ? (nodeType, widgetName) =>
          assetService.shouldUseAssetBrowser(nodeType, widgetName)
      : () => false,
    (nodeType) => useModelToNodeStore().getCategoryForNodeType(nodeType)
  )
  const confirmedModels = modelCandidates.filter((c) => c.isMissing === true)
  if (confirmedModels.length) {
    useMissingModelStore().addMissingModels(confirmedModels)
  }
  // Cloud scans return isMissing: undefined for asset-browser-supported
  // widgets until async verification resolves. Without this, realtime
  // add/un-bypass paths would silently drop those candidates.
  const pendingModels = modelCandidates.filter((c) => c.isMissing === undefined)
  if (pendingModels.length) {
    void verifyAndAddPendingModels(pendingModels)
  }

  if (node.isSubgraphNode?.()) return

  const originalType = node.last_serialization?.type ?? node.type ?? 'Unknown'
  if (!(originalType in LiteGraph.registered_node_types)) {
    const nodeReplacementStore = useNodeReplacementStore()
    const replacement = nodeReplacementStore.getReplacementFor(originalType)
    const store = useMissingNodesErrorStore()
    const existing = store.missingNodesError?.nodeTypes ?? []
    store.surfaceMissingNodes([
      ...existing,
      {
        type: originalType,
        nodeId: execId,
        cnrId: getCnrIdFromNode(node),
        isReplaceable: replacement !== null,
        replacement: replacement ?? undefined
      }
    ])
  }
}

function scanSingleNodeMedia(node: LGraphNode): void {
  if (!app.rootGraph) return
  if (!getActiveExecutionId(node)) return

  const mediaCandidates = scanNodeMediaCandidates(app.rootGraph, node, isCloud)
  const confirmedMedia = mediaCandidates.filter((c) => c.isMissing === true)
  if (confirmedMedia.length) {
    useMissingMediaStore().addMissingMedia(confirmedMedia)
  }
  // Cloud media scans return pending for asset verification. OSS scans only
  // return pending for generated output media.
  const pendingMedia = mediaCandidates.filter((c) => c.isMissing === undefined)
  if (pendingMedia.length) {
    void verifyAndAddPendingMedia(pendingMedia)
  }
}

/**
 * True when the candidate's node still exists in the current root graph
 * and is active. Filters out late verification results for nodes that
 * have been bypassed, deleted, or belong to a workflow that is no
 * longer current — any of which would reintroduce stale errors.
 */
function isModelCandidateStillActive(
  candidate: MissingModelCandidate
): boolean {
  return isMissingCandidateActive(app.rootGraph, candidate)
}

function isNodeCandidateStillActive(nodeId: unknown): boolean {
  return (
    app.rootGraph != null &&
    nodeId != null &&
    isExecutionPathActive(app.rootGraph, String(nodeId))
  )
}

async function verifyAndAddPendingModels(
  pending: MissingModelCandidate[]
): Promise<void> {
  // Capture rootGraph at scan time so a late verification for workflow
  // A cannot leak into workflow B after a switch — execution IDs (esp.
  // root-level like "1") collide across workflows.
  const rootGraphAtScan = app.rootGraph
  try {
    await verifyAssetSupportedCandidates(pending)
    if (app.rootGraph !== rootGraphAtScan) return
    const verified = pending.filter(
      (c) => c.isMissing === true && isModelCandidateStillActive(c)
    )
    if (verified.length) useMissingModelStore().addMissingModels(verified)
  } catch (error: unknown) {
    console.warn('[useErrorClearingHooks] model verification failed:', error)
  }
}

async function verifyAndAddPendingMedia(
  pending: MissingMediaCandidate[]
): Promise<void> {
  const rootGraphAtScan = app.rootGraph
  try {
    await verifyMediaCandidates(pending, { isCloud })
    if (app.rootGraph !== rootGraphAtScan) return
    const verified = pending.filter(
      (c) => c.isMissing === true && isNodeCandidateStillActive(c.nodeId)
    )
    if (verified.length) useMissingMediaStore().addMissingMedia(verified)
  } catch (error: unknown) {
    console.warn('[useErrorClearingHooks] media verification failed:', error)
  }
}

function scanAddedNode(
  node: LGraphNode,
  scanNode: (node: LGraphNode) => void
): void {
  if (!app.rootGraph || ChangeTracker.isLoadingGraph) return
  if (isNodeInactive(node.mode)) return
  scanNodeErrorTargets(node, scanNode)
}

function scheduleAddedNodeScan(node: LGraphNode): void {
  queueMicrotask(() => {
    scanAddedNode(node, scanSingleNodeModelsAndTypes)
    // Paste/drop upload handlers run immediately after graph.add and must set
    // node.isUploading synchronously before their first await. This second
    // microtask lets that upload state settle before media widgets are scanned.
    queueMicrotask(() => scanAddedNode(node, scanSingleNodeMedia))
  })
}

function handleNodeModeChange(
  localGraph: LGraph,
  nodeId: NodeId,
  oldMode: number,
  newMode: number
): void {
  if (!app.rootGraph) return

  const wasInactive = isNodeInactive(oldMode)
  const isNowInactive = isNodeInactive(newMode)

  if (wasInactive === isNowInactive) return

  // Find the node by local ID in the graph that fired the event,
  // then compute its execution ID relative to the root graph.
  const node = localGraph.getNodeById(nodeId)
  if (!node) return

  const execId = getExecutionIdByNode(app.rootGraph, node)
  if (!execId) return

  if (isNowInactive) {
    removeNodeErrors(node, execId)
  } else {
    scanAndAddNodeErrors(node)
    scanAncestorSubgraphHosts(execId)
    if (
      useMissingModelStore().hasMissingModels ||
      useMissingMediaStore().hasMissingMedia ||
      useMissingNodesErrorStore().hasMissingNodes
    ) {
      useExecutionErrorStore().showErrorOverlay()
    }
  }
}

function scanAncestorSubgraphHosts(execId: string): void {
  if (!app.rootGraph) return
  for (const ancestorId of getParentExecutionIds(execId)) {
    if (!isExecutionPathActive(app.rootGraph, ancestorId)) continue
    const ancestor = getNodeByExecutionId(app.rootGraph, ancestorId)
    if (ancestor?.isSubgraphNode?.()) scanSingleNodeErrors(ancestor)
  }
}

/** Remove all missing asset errors for a node and, if it's a subgraph
 *  container, for all interior nodes (prefix match on execution ID). */
function removeNodeErrors(node: LGraphNode, execId: string): void {
  const modelStore = useMissingModelStore()
  const mediaStore = useMissingMediaStore()
  const nodesStore = useMissingNodesErrorStore()

  modelStore.removeMissingModelsByNodeId(execId)
  modelStore.removeMissingModelsBySourceScope(execId)
  mediaStore.removeMissingMediaByNodeId(execId)
  nodesStore.removeMissingNodesByNodeId(execId)

  // For subgraph containers, also remove errors from interior nodes.
  // The trailing colon in the prefix is load-bearing: it prevents sibling
  // IDs sharing a numeric prefix (e.g. "705" vs "70") from being matched.
  if (node.isSubgraphNode?.() && node.subgraph) {
    const prefix = `${execId}:`
    modelStore.removeMissingModelsByPrefix(prefix)
    mediaStore.removeMissingMediaByPrefix(prefix)
    nodesStore.removeMissingNodesByPrefix(prefix)
  }
}

export function installErrorClearingHooks(graph: LGraph): () => void {
  for (const node of graph._nodes ?? []) {
    installNodeHooksRecursive(node)
  }

  const originalOnNodeAdded = graph.onNodeAdded
  graph.onNodeAdded = function (node: LGraphNode) {
    installNodeHooksRecursive(node)

    // Scan pasted/duplicated nodes for missing models/media.
    // Skip during loadGraphData (undo/redo/tab switch) — those are
    // handled by the full pipeline or cache restore.
    // Model and node scans use the original one-microtask deferral so pasted
    // missing-model errors appear before selection-scoped tabs recalculate.
    // Media gets one extra microtask so drag/drop upload handlers can mark
    // transient upload state before media detection reads the widget value.
    if (!ChangeTracker.isLoadingGraph) {
      scheduleAddedNodeScan(node)
    }

    originalOnNodeAdded?.call(this, node)
  }

  const originalOnNodeRemoved = graph.onNodeRemoved
  graph.onNodeRemoved = function (node: LGraphNode) {
    // node.graph is already null by the time onNodeRemoved fires, so
    // derive the execution ID from the graph the hook is installed on
    // plus node.id. For subgraph interior nodes this yields the full
    // "parentId:...:nodeId" path that matches how missing asset errors
    // are keyed; without this, removal falls back to the local ID and
    // misses subgraph entries.
    const execId = getRemovedNodeExecutionId(graph, node.id)
    removeNodeErrors(node, execId)
    restoreNodeHooksRecursive(node)
    originalOnNodeRemoved?.call(this, node)
  }

  const originalOnTrigger = graph.onTrigger
  graph.onTrigger = (event: LGraphTriggerEvent) => {
    if (event.type === 'node:property:changed' && event.property === 'mode') {
      handleNodeModeChange(
        graph,
        toNodeId(event.nodeId),
        event.oldValue as number,
        event.newValue as number
      )
    }
    originalOnTrigger?.(event)
  }

  return () => {
    for (const node of graph._nodes ?? []) {
      restoreNodeHooksRecursive(node)
    }
    graph.onNodeAdded = originalOnNodeAdded || undefined
    graph.onNodeRemoved = originalOnNodeRemoved || undefined
    graph.onTrigger = originalOnTrigger || undefined
  }
}
