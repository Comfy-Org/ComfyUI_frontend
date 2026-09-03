/**
 * Installs per-node error-clearing callbacks (onConnectionsChange,
 * onWidgetChanged) on all current and future nodes in a graph.
 *
 * Decoupled from the Vue rendering lifecycle so that error auto-clearing
 * works in legacy canvas mode as well.
 */
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import { createPromotionErrorReconciler } from '@/core/graph/subgraph/createPromotionErrorReconciler'
import type {
  NodeBeforeRemovedEvent,
  NodeLifecycleEvent
} from '@/lib/litegraph/src/infrastructure/LGraphEventMap'
import { LiteGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
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
  isMissingMediaCandidateActive,
  isMissingMediaCandidateScopeActive,
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

function getRootGraph(): LGraph | null {
  const rootGraph: unknown = Reflect.get(app, 'rootGraph')
  return rootGraph instanceof LiteGraph.LGraph ? rootGraph : null
}

function getRemovedNodeExecutionId(graph: LGraph, nodeId: NodeId): string {
  const rootGraph = getRootGraph()
  if (!rootGraph) return String(nodeId)

  return (
    getExecutionIdForNodeInGraph(rootGraph, graph, nodeId) ?? String(nodeId)
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
      if (type !== NodeSlotType.INPUT) return
      const rootGraph = getRootGraph()
      if (!rootGraph) return
      const slotName = node.inputs[slotIndex].name
      if (!slotName) return
      const execId = getExecutionIdByNode(rootGraph, node)
      if (!execId) return
      if (isConnected) {
        useExecutionErrorStore().clearSimpleNodeErrors(execId, slotName)
      }
      queueMicrotask(() => {
        if (!getRootGraph() || ChangeTracker.isLoadingGraph) return
        dropOutOfScopeMissingMedia()
        if (!isConnected) scanSingleNodeMedia(node)
      })
    }
  )

  node.onWidgetChanged = useChainCallback(
    node.onWidgetChanged,
    function (name, newValue, _oldValue, widget) {
      const rootGraph = getRootGraph()
      if (!rootGraph) return
      const hostExecId = getExecutionIdByNode(rootGraph, node)
      if (!hostExecId) return

      const options = { min: widget.options.min, max: widget.options.max }
      const source = resolvePromotedWidgetSource(rootGraph, node, widget)
      if (source?.sourceExecutionId) {
        useExecutionErrorStore().clearWidgetRelatedErrors(
          source.sourceExecutionId,
          source.sourceWidgetName,
          source.sourceWidgetName,
          newValue,
          options
        )
      }

      useExecutionErrorStore().clearWidgetRelatedErrors(
        hostExecId,
        name,
        widget.name,
        newValue,
        options
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
  if (node.isSubgraphNode()) {
    for (const innerNode of node.subgraph._nodes) {
      installNodeHooksRecursive(innerNode)
    }
  }
}

function restoreNodeHooksRecursive(node: LGraphNode): void {
  restoreNodeHooks(node)
  if (node.isSubgraphNode()) {
    for (const innerNode of node.subgraph._nodes) {
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
  if (!getRootGraph()) return

  if (node.isSubgraphNode()) {
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
  const rootGraph = getRootGraph()
  if (!rootGraph) return null
  // Skip when any enclosing subgraph is muted/bypassed. Callers only
  // verify each node's own mode, so an active node added inside a
  // bypassed subgraph reaches this point without the ancestor check.
  // A null execId means the node has no current graph (e.g. detached
  // mid lifecycle) — also skip, since we cannot verify its scope.
  const execId = getExecutionIdByNode(rootGraph, node)
  if (!execId || !isExecutionPathActive(rootGraph, execId)) return null
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

function scanSingleNodeModelsAndTypes(
  node: LGraphNode,
  pendingVerifications?: Promise<void>[],
  signal?: AbortSignal
): void {
  const rootGraph = getRootGraph()
  if (!rootGraph) return
  const execId = getActiveExecutionId(node)
  if (!execId) return

  const modelCandidates = scanNodeModelCandidates(
    rootGraph,
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
    const verification = verifyAndAddPendingModels(pendingModels, signal)
    if (pendingVerifications) pendingVerifications.push(verification)
    else void verification
  }

  if (node.isSubgraphNode()) return

  const originalType = node.last_serialization?.type ?? node.type
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

function scanSingleNodeMedia(
  node: LGraphNode,
  pendingVerifications?: Promise<void>[],
  signal?: AbortSignal
): void {
  const rootGraph = getRootGraph()
  if (!rootGraph) return
  if (!getActiveExecutionId(node)) return

  const mediaCandidates = scanNodeMediaCandidates(rootGraph, node, isCloud)
  const confirmedMedia = mediaCandidates.filter((c) => c.isMissing === true)
  if (confirmedMedia.length) {
    useMissingMediaStore().addMissingMedia(confirmedMedia)
  }
  // Cloud media scans return pending for asset verification. OSS scans only
  // return pending for generated output media.
  const pendingMedia = mediaCandidates.filter((c) => c.isMissing === undefined)
  if (pendingMedia.length) {
    const verification = verifyAndAddPendingMedia(pendingMedia, signal)
    if (pendingVerifications) pendingVerifications.push(verification)
    else void verification
  }
}

/**
 * True when the candidate's node still exists in the current root graph
 * and is active. Filters out late verification results for nodes that
 * have been bypassed, deleted, or belong to a workflow that is no
 * longer current — any of which would reintroduce stale errors.
 */
function isModelCandidateStillMissingAndActive(
  candidate: MissingModelCandidate
): boolean {
  const rootGraph = getRootGraph()
  if (!isMissingCandidateActive(rootGraph, candidate)) return false
  if (!rootGraph || candidate.nodeId == null) return true

  const node = getNodeByExecutionId(rootGraph, String(candidate.nodeId))
  const widget = node?.widgets?.find(
    (candidateWidget) => candidateWidget.name === candidate.widgetName
  )
  if (!node || !widget || widget.value !== candidate.name) return false
  if (node.getSlotFromWidget(widget)?.link != null) return false
  if (!node.isSubgraphNode()) return true

  return (
    resolvePromotedWidgetSource(rootGraph, node, widget)?.sourceExecutionId ===
    candidate.sourceExecutionId
  )
}

function hasSameNodeOwner(
  rootGraph: LGraph,
  candidate: { nodeId?: string | number | null },
  ownerAtScan: LGraphNode | null | undefined
): boolean {
  return (
    candidate.nodeId == null ||
    ownerAtScan === getNodeByExecutionId(rootGraph, String(candidate.nodeId))
  )
}

async function verifyAndAddPendingModels(
  pending: MissingModelCandidate[],
  signal?: AbortSignal
): Promise<void> {
  // Capture rootGraph at scan time so a late verification for workflow
  // A cannot leak into workflow B after a switch — execution IDs (esp.
  // root-level like "1") collide across workflows.
  const rootGraphAtScan = getRootGraph()
  const ownersAtScan = new Map(
    pending.map((candidate) => [
      candidate,
      candidate.nodeId == null || rootGraphAtScan === null
        ? null
        : getNodeByExecutionId(rootGraphAtScan, String(candidate.nodeId))
    ])
  )
  try {
    await verifyAssetSupportedCandidates(pending, signal)
    if (
      signal?.aborted ||
      !rootGraphAtScan ||
      getRootGraph() !== rootGraphAtScan
    )
      return
    const verified = pending.filter(
      (candidate) =>
        hasSameNodeOwner(
          rootGraphAtScan,
          candidate,
          ownersAtScan.get(candidate)
        ) && isModelCandidateStillMissingAndActive(candidate)
    )
    if (verified.length) useMissingModelStore().addMissingModels(verified)
  } catch (error: unknown) {
    console.warn('[useErrorClearingHooks] model verification failed:', error)
  }
}

async function verifyAndAddPendingMedia(
  pending: MissingMediaCandidate[],
  signal?: AbortSignal
): Promise<void> {
  const rootGraphAtScan = getRootGraph()
  const ownersAtScan = new Map(
    pending.map((candidate) => [
      candidate,
      rootGraphAtScan
        ? getNodeByExecutionId(rootGraphAtScan, String(candidate.nodeId))
        : null
    ])
  )
  try {
    await verifyMediaCandidates(pending, { isCloud, signal })
    if (
      signal?.aborted ||
      !rootGraphAtScan ||
      getRootGraph() !== rootGraphAtScan
    )
      return
    const verified = pending.filter(
      (candidate) =>
        hasSameNodeOwner(
          rootGraphAtScan,
          candidate,
          ownersAtScan.get(candidate)
        ) && isMissingMediaCandidateActive(rootGraphAtScan, candidate)
    )
    if (verified.length) useMissingMediaStore().addMissingMedia(verified)
  } catch (error: unknown) {
    console.warn('[useErrorClearingHooks] media verification failed:', error)
  }
}

function scanAddedNode(
  rootGraph: LGraph,
  node: LGraphNode,
  scanNode: (node: LGraphNode) => void
): void {
  if (getRootGraph() !== rootGraph || ChangeTracker.isLoadingGraph) return
  if (isNodeInactive(node.mode)) return
  scanNodeErrorTargets(node, scanNode)
}

async function runAddedNodeScan(
  rootGraph: LGraph,
  node: LGraphNode,
  signal: AbortSignal
): Promise<void> {
  const pendingVerifications: Promise<void>[] = []

  try {
    await Promise.resolve()
    if (signalAborted(signal) || getRootGraph() !== rootGraph) return
    scanAddedNode(rootGraph, node, (target) =>
      scanSingleNodeModelsAndTypes(target, pendingVerifications, signal)
    )

    // Paste/drop handlers need another microtask to mark upload state before
    // media detection reads the widget value.
    await Promise.resolve()
    if (signalAborted(signal) || getRootGraph() !== rootGraph) return
    scanAddedNode(rootGraph, node, (target) =>
      scanSingleNodeMedia(target, pendingVerifications, signal)
    )
  } finally {
    await Promise.allSettled(pendingVerifications)
  }
}

interface PendingScanControl {
  cancel: () => void
  finish: () => void
}

function signalAborted(signal: AbortSignal): boolean {
  return signal.aborted
}

function scheduleAddedNodeScan(
  node: LGraphNode,
  pendingScans: Map<LGraphNode, Set<PendingScanControl>>
): void {
  const rootGraph = getRootGraph()
  if (!rootGraph || ChangeTracker.isLoadingGraph) return
  if (isNodeInactive(node.mode)) return

  const executionId = getExecutionIdByNode(rootGraph, node)
  if (!executionId) return

  const finishPendingScan = useExecutionErrorStore().beginAddedNodeErrorScan(
    rootGraph,
    executionId
  )
  const abortController = new AbortController()
  const existingScans = pendingScans.get(node)
  const scansForNode = existingScans ?? new Set<PendingScanControl>()
  if (!existingScans) {
    pendingScans.set(node, scansForNode)
  }

  function finish() {
    finishPendingScan()
    scansForNode.delete(control)
    if (scansForNode.size === 0) pendingScans.delete(node)
  }

  function cancel() {
    abortController.abort()
    finish()
  }

  const control = { cancel, finish }
  scansForNode.add(control)
  void runAddedNodeScan(rootGraph, node, abortController.signal)
    .catch((error: unknown) => {
      console.warn('[useErrorClearingHooks] added-node scan failed:', error)
    })
    .finally(finish)
}

function handleNodeModeChange(
  localGraph: LGraph,
  nodeId: NodeId,
  oldMode: number,
  newMode: number
): void {
  const rootGraph = getRootGraph()
  if (!rootGraph) return

  const wasInactive = isNodeInactive(oldMode)
  const isNowInactive = isNodeInactive(newMode)

  if (wasInactive === isNowInactive) return

  // Find the node by local ID in the graph that fired the event,
  // then compute its execution ID relative to the root graph.
  const node = localGraph.getNodeById(nodeId)
  if (!node) return

  const execId = getExecutionIdByNode(rootGraph, node)
  if (!execId) return

  if (isNowInactive) {
    removeNodeErrors(node, execId)
    dropOutOfScopeMissingMedia()
  } else {
    scanAndAddNodeErrors(node)
    scanAncestorSubgraphHosts(execId)
    const executionErrorStore = useExecutionErrorStore()
    if (executionErrorStore.hasMissingError) {
      executionErrorStore.showErrorOverlay()
    }
  }
}

function scanAncestorSubgraphHosts(execId: string): void {
  const rootGraph = getRootGraph()
  if (!rootGraph) return
  for (const ancestorId of getParentExecutionIds(execId)) {
    if (!isExecutionPathActive(rootGraph, ancestorId)) continue
    const ancestor = getNodeByExecutionId(rootGraph, ancestorId)
    if (ancestor?.isSubgraphNode()) scanSingleNodeErrors(ancestor)
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
  if (node.isSubgraphNode()) {
    const prefix = `${execId}:`
    modelStore.removeMissingModelsByPrefix(prefix)
    mediaStore.removeMissingMediaByPrefix(prefix)
    nodesStore.removeMissingNodesByPrefix(prefix)
  }
}

/** Removes candidates whose widget is no longer the editable value owner. */
function dropOutOfScopeMissingMedia(): void {
  const rootGraph = getRootGraph()
  if (!rootGraph || ChangeTracker.isLoadingGraph) return

  const mediaStore = useMissingMediaStore()
  const candidates = mediaStore.missingMediaCandidates
  if (!candidates) return
  const inScope = candidates.filter((candidate) =>
    isMissingMediaCandidateScopeActive(rootGraph, candidate)
  )
  if (inScope.length === candidates.length) return
  mediaStore.setMissingMedia(inScope)
}

export function installErrorClearingHooks(graph: LGraph): () => void {
  const pendingScans = new Map<LGraphNode, Set<PendingScanControl>>()
  let disposed = false
  let pendingOutOfScopeDrop = false

  /**
   * Coalesces `dropOutOfScopeMissingMedia` across a burst of removals, which
   * would otherwise re-walk every candidate's topology once per removed node.
   */
  const scheduleDropOutOfScopeMissingMedia = (): void => {
    if (pendingOutOfScopeDrop) return
    pendingOutOfScopeDrop = true
    queueMicrotask(() => {
      pendingOutOfScopeDrop = false
      if (disposed) return
      dropOutOfScopeMissingMedia()
    })
  }

  const promotionErrors = createPromotionErrorReconciler({
    dropOutOfScope: dropOutOfScopeMissingMedia,
    rescanHost: (subgraphNode) =>
      scanNodeErrorTargets(subgraphNode, scanSingleNodeMedia),
    removeHostWidgetCandidate: (subgraphNode, widgetName) => {
      const rootGraph = getRootGraph()
      if (!rootGraph) return
      const executionId = getExecutionIdByNode(rootGraph, subgraphNode)
      if (!executionId) return
      useMissingMediaStore().removeMissingMediaByWidget(executionId, widgetName)
    }
  })

  if (graph instanceof Subgraph) promotionErrors.attach(graph)
  for (const node of graph._nodes) {
    installNodeHooksRecursive(node)
    promotionErrors.attachNode(node)
  }

  const onNodeAdded = ({ detail: { node } }: NodeLifecycleEvent) => {
    if (disposed) return
    installNodeHooksRecursive(node)
    promotionErrors.attachNode(node)
    scheduleAddedNodeScan(node, pendingScans)
  }

  // `node:before-removed` covers both single removals and graph.clear();
  // `node:removed` fires only from LGraph.remove.
  const onNodeRemoved = ({
    detail: { node, successor }
  }: NodeBeforeRemovedEvent) => {
    if (disposed) return
    for (const scan of pendingScans.get(node) ?? []) scan.cancel()
    // Derive the execution ID from the graph the hook is installed on plus
    // node.id. For subgraph interior nodes this yields the full
    // "parentId:...:nodeId" path that matches how missing asset errors are
    // keyed; without this, removal falls back to the local ID and misses
    // subgraph entries.
    if (!successor) {
      const execId = getRemovedNodeExecutionId(graph, node.id)
      removeNodeErrors(node, execId)
    }
    scheduleDropOutOfScopeMissingMedia()
    restoreNodeHooksRecursive(node)
    promotionErrors.detachNode(node)
  }

  graph.events.addEventListener('node:added', onNodeAdded)
  graph.events.addEventListener('node:before-removed', onNodeRemoved)

  const originalOnTrigger = graph.onTrigger
  graph.onTrigger = (event: LGraphTriggerEvent) => {
    if (disposed) {
      originalOnTrigger?.(event)
      return
    }
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
    if (disposed) return
    disposed = true
    for (const scans of pendingScans.values()) {
      for (const scan of scans) scan.finish()
    }
    for (const node of graph._nodes) {
      restoreNodeHooksRecursive(node)
    }
    graph.events.removeEventListener('node:added', onNodeAdded)
    graph.events.removeEventListener('node:before-removed', onNodeRemoved)
    graph.onTrigger = originalOnTrigger || undefined
    promotionErrors.dispose()
  }
}
