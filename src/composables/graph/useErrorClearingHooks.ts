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
import { scanNodeModelCandidates } from '@/platform/missingModel/missingModelScan'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { scanNodeMediaCandidates } from '@/platform/missingMedia/missingMediaScan'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useNodeReplacementStore } from '@/platform/nodeReplacement/nodeReplacementStore'
import { getCnrIdFromNode } from '@/platform/nodeReplacement/cnrIdUtil'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import {
  collectAllNodes,
  getExecutionIdByNode
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

  const mediaCandidates = scanNodeMediaCandidates(app.rootGraph, node, isCloud)
  const confirmedMedia = mediaCandidates.filter((c) => c.isMissing === true)
  if (confirmedMedia.length) {
    useMissingMediaStore().addMissingMedia(confirmedMedia)
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

  // For subgraph containers, also remove errors from interior nodes
  if (node.isSubgraphNode?.() && node.subgraph) {
    const prefix = `${execId}:`
    for (const candidate of modelStore.missingModelCandidates ?? []) {
      if (String(candidate.nodeId).startsWith(prefix)) {
        modelStore.removeMissingModelsByNodeId(String(candidate.nodeId))
      }
    }
    for (const candidate of mediaStore.missingMediaCandidates ?? []) {
      if (String(candidate.nodeId).startsWith(prefix)) {
        mediaStore.removeMissingMediaByNodeId(String(candidate.nodeId))
      }
    }
    const nodeTypes = nodesStore.missingNodesError?.nodeTypes ?? []
    for (const nt of nodeTypes) {
      if (typeof nt !== 'string' && String(nt.nodeId).startsWith(prefix)) {
        nodesStore.removeMissingNodesByNodeId(String(nt.nodeId))
      }
    }
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
    // node.graph is already null by the time onNodeRemoved fires,
    // so use the graph that this hook is installed on to build the
    // execution ID. Root-level nodes use their ID directly; subgraph
    // interior nodes are handled by LGraph's recursive removal which
    // calls onNodeRemoved on the subgraph's graph instance.
    const execId =
      graph === app.rootGraph
        ? String(node.id)
        : getExecutionIdByNode(app.rootGraph, node)
    if (execId) {
      useMissingModelStore().removeMissingModelsByNodeId(execId)
      useMissingMediaStore().removeMissingMediaByNodeId(execId)
      useMissingNodesErrorStore().removeMissingNodesByNodeId(execId)
    }
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
