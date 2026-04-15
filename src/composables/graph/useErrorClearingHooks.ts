/**
 * Installs per-node error-clearing callbacks (onConnectionsChange,
 * onWidgetChanged) on all current and future nodes in a graph.
 *
 * Decoupled from the Vue rendering lifecycle so that error auto-clearing
 * works in legacy canvas mode as well.
 */
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
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
  verifyCloudMediaCandidates
} from '@/platform/missingMedia/missingMediaScan'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useNodeReplacementStore } from '@/platform/nodeReplacement/nodeReplacementStore'
import { getCnrIdFromNode } from '@/platform/nodeReplacement/cnrIdUtil'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import {
  collectAllNodes,
  getExecutionIdByNode,
  getExecutionIdForNodeInGraph,
  getNodeByExecutionId,
  isAncestorPathActive
} from '@/utils/graphTraversalUtil'

function resolvePromotedExecId(
  rootGraph: LGraph,
  node: LGraphNode,
  widget: IBaseWidget,
  hostExecId: string
): string {
  if (!isPromotedWidgetView(widget)) return hostExecId
  const result = resolveConcretePromotedWidget(
    node,
    widget.sourceNodeId,
    widget.sourceWidgetName
  )
  if (result.status === 'resolved' && result.resolved.node) {
    return getExecutionIdByNode(rootGraph, result.resolved.node) ?? hostExecId
  }
  return hostExecId
}

const hookedNodes = new WeakSet<LGraphNode>()

type OriginalCallbacks = {
  onConnectionsChange: LGraphNode['onConnectionsChange']
  onWidgetChanged: LGraphNode['onWidgetChanged']
}

const originalCallbacks = new WeakMap<LGraphNode, OriginalCallbacks>()

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
    // _name is the LiteGraph callback arg; re-derive from the widget
    // object to handle promoted widgets where sourceWidgetName differs.
    function (_name, newValue, _oldValue, widget) {
      if (!app.rootGraph) return
      const hostExecId = getExecutionIdByNode(app.rootGraph, node)
      if (!hostExecId) return

      const execId = resolvePromotedExecId(
        app.rootGraph,
        node,
        widget,
        hostExecId
      )
      const widgetName = isPromotedWidgetView(widget)
        ? widget.sourceWidgetName
        : widget.name

      useExecutionErrorStore().clearWidgetRelatedErrors(
        execId,
        widget.name,
        widgetName,
        newValue,
        { min: widget.options?.min, max: widget.options?.max }
      )
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

/** Scan a single node and add confirmed missing model/media to stores.
 *  For subgraph containers, also scans all active interior nodes. */
function scanAndAddNodeErrors(node: LGraphNode): void {
  if (!app.rootGraph) return

  if (node.isSubgraphNode?.() && node.subgraph) {
    for (const innerNode of collectAllNodes(node.subgraph)) {
      if (isNodeInactive(innerNode.mode)) continue
      scanSingleNodeErrors(innerNode)
    }
    return
  }

  scanSingleNodeErrors(node)
}

function scanSingleNodeErrors(node: LGraphNode): void {
  if (!app.rootGraph) return
  // Skip when any enclosing subgraph is muted/bypassed. Callers only
  // verify each node's own mode; entering a bypassed subgraph (via
  // useGraphNodeManager replaying onNodeAdded for existing interior
  // nodes) reaches this point without the ancestor check. A null
  // execId means the node has no current graph (e.g. detached mid
  // lifecycle) — also skip, since we cannot verify its scope.
  const execId = getExecutionIdByNode(app.rootGraph, node)
  if (!execId || !isAncestorPathActive(app.rootGraph, execId)) return

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

  const mediaCandidates = scanNodeMediaCandidates(app.rootGraph, node, isCloud)
  const confirmedMedia = mediaCandidates.filter((c) => c.isMissing === true)
  if (confirmedMedia.length) {
    useMissingMediaStore().addMissingMedia(confirmedMedia)
  }
  // Cloud media scans always return isMissing: undefined pending
  // verification against the input-assets list.
  const pendingMedia = mediaCandidates.filter((c) => c.isMissing === undefined)
  if (pendingMedia.length) {
    void verifyAndAddPendingMedia(pendingMedia)
  }

  // Check for missing node type
  const originalType = node.last_serialization?.type ?? node.type ?? 'Unknown'
  if (!(originalType in LiteGraph.registered_node_types)) {
    const execId = getExecutionIdByNode(app.rootGraph, node)
    if (execId) {
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
}

/**
 * True when the candidate's node still exists in the current root graph
 * and is active. Filters out late verification results for nodes that
 * have been bypassed, deleted, or belong to a workflow that is no
 * longer current — any of which would reintroduce stale errors.
 */
function isCandidateStillActive(nodeId: unknown): boolean {
  if (!app.rootGraph || nodeId == null) return false
  const execId = String(nodeId)
  const node = getNodeByExecutionId(app.rootGraph, execId)
  if (!node) return false
  if (isNodeInactive(node.mode)) return false
  // Also reject if any enclosing subgraph was bypassed between scan
  // kick-off and verification resolving — mirrors the pipeline-level
  // ancestor post-filter so realtime and initial-load paths stay
  // symmetric.
  return isAncestorPathActive(app.rootGraph, execId)
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
      (c) => c.isMissing === true && isCandidateStillActive(c.nodeId)
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
    await verifyCloudMediaCandidates(pending)
    if (app.rootGraph !== rootGraphAtScan) return
    const verified = pending.filter(
      (c) => c.isMissing === true && isCandidateStillActive(c.nodeId)
    )
    if (verified.length) useMissingMediaStore().addMissingMedia(verified)
  } catch (error: unknown) {
    console.warn('[useErrorClearingHooks] media verification failed:', error)
  }
}

function scanAddedNode(node: LGraphNode): void {
  if (!app.rootGraph || ChangeTracker.isLoadingGraph) return
  if (isNodeInactive(node.mode)) return
  scanAndAddNodeErrors(node)
}

function handleNodeModeChange(
  localGraph: LGraph,
  nodeId: number,
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
    if (
      useMissingModelStore().hasMissingModels ||
      useMissingMediaStore().hasMissingMedia ||
      useMissingNodesErrorStore().hasMissingNodes
    ) {
      useExecutionErrorStore().showErrorOverlay()
    }
  }
}

/** Remove all missing asset errors for a node and, if it's a subgraph
 *  container, for all interior nodes (prefix match on execution ID). */
function removeNodeErrors(node: LGraphNode, execId: string): void {
  const modelStore = useMissingModelStore()
  const mediaStore = useMissingMediaStore()
  const nodesStore = useMissingNodesErrorStore()

  modelStore.removeMissingModelsByNodeId(execId)
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
    // Deferred to microtask because onNodeAdded fires before
    // node.configure() restores widget values.
    if (!ChangeTracker.isLoadingGraph) {
      queueMicrotask(() => scanAddedNode(node))
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
    const execId = app.rootGraph
      ? getExecutionIdForNodeInGraph(app.rootGraph, graph, node.id)
      : String(node.id)
    removeNodeErrors(node, execId)
    restoreNodeHooksRecursive(node)
    originalOnNodeRemoved?.call(this, node)
  }

  const originalOnTrigger = graph.onTrigger
  graph.onTrigger = (event: LGraphTriggerEvent) => {
    if (event.type === 'node:property:changed' && event.property === 'mode') {
      handleNodeModeChange(
        graph,
        event.nodeId as number,
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
