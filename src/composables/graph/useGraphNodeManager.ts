import type {
  LGraph,
  LGraphNode,
  LGraphTriggerEvent
} from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import {
  buildSlotMetadata,
  extractVueNodeData
} from '@/renderer/extensions/vueNodes/utils/nodeDataExtraction'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

export function useGraphNodeManager(graph: LGraph): () => void {
  const nodeDataStore = useNodeDataStore()

  const refreshNodeSlots = (nodeId: NodeId) => {
    const nodeRef = graph.getNodeById(nodeId)
    const currentData = nodeDataStore.getNodeData(graph.id, nodeId)
    if (!nodeRef || !currentData) return

    const slotMetadata = buildSlotMetadata(nodeRef.inputs, graph)
    for (const widget of currentData.widgets ?? []) {
      widget.slotMetadata = slotMetadata.get(widget.name)
    }
  }

  const upsertNodeData = (node: LGraphNode) => {
    const data = extractVueNodeData(node)
    if (!nodeDataStore.patchNodeData(graph.id, node.id, data)) {
      nodeDataStore.registerNodeData(graph.id, node.id, data)
    }
  }

  const syncWithGraph = () => {
    if (!graph?._nodes) return

    const currentNodes = new Set(graph._nodes.map((node) => node.id))

    for (const { id } of nodeDataStore.getGraphNodes(graph.id)) {
      if (!currentNodes.has(id)) {
        nodeDataStore.deleteNodeData(graph.id, id)
      }
    }

    graph._nodes.forEach((node) => {
      upsertNodeData(node)
    })
  }

  const handleNodeAdded = (
    node: LGraphNode,
    originalCallback?: (node: LGraphNode) => void
  ) => {
    upsertNodeData(node)
    originalCallback?.(node)
  }

  const dropNodeReferences = (id: NodeId) => {
    nodeDataStore.deleteNodeData(graph.id, id)
  }

  const handleNodeRemoved = (
    node: LGraphNode,
    originalCallback?: (node: LGraphNode) => void
  ) => {
    dropNodeReferences(node.id)
    originalCallback?.(node)
  }

  const originalOnNodeAdded = graph.onNodeAdded
  const originalOnNodeRemoved = graph.onNodeRemoved
  const originalOnTrigger = graph.onTrigger

  graph.onNodeAdded = (node: LGraphNode) => {
    handleNodeAdded(node, originalOnNodeAdded)
  }

  graph.onNodeRemoved = (node: LGraphNode) => {
    handleNodeRemoved(node, originalOnNodeRemoved)
  }

  const beforeNodeRemovedListener = (e: CustomEvent<{ node: LGraphNode }>) => {
    dropNodeReferences(e.detail.node.id)
  }
  graph.events.addEventListener(
    'node:before-removed',
    beforeNodeRemovedListener
  )

  graph.onTrigger = (event: LGraphTriggerEvent) => {
    switch (event.type) {
      case 'node:property:changed':
        nodeDataStore.patchNodeProperty(
          graph.id,
          toNodeId(event.nodeId),
          event.property,
          event.newValue
        )
        break
      case 'node:slot-errors:changed':
        refreshNodeSlots(toNodeId(event.nodeId))
        break
      case 'node:slot-links:changed':
        if (event.slotType === NodeSlotType.INPUT) {
          refreshNodeSlots(toNodeId(event.nodeId))
        }
        break
      case 'node:slot-label:changed': {
        const nodeId = toNodeId(event.nodeId)
        const nodeRef = graph.getNodeById(nodeId)
        if (!nodeRef) break

        if (event.slotType !== NodeSlotType.OUTPUT && nodeRef.inputs) {
          nodeDataStore.patchNodeData(graph.id, nodeId, {
            inputs: [...nodeRef.inputs]
          })
        }
        if (event.slotType !== NodeSlotType.INPUT && nodeRef.outputs) {
          nodeDataStore.patchNodeData(graph.id, nodeId, {
            outputs: [...nodeRef.outputs]
          })
        }
        break
      }
    }

    originalOnTrigger?.(event)
  }

  syncWithGraph()

  graph._nodes?.forEach((node: LGraphNode) => {
    graph.onNodeAdded?.(node)
  })

  return () => {
    graph.onNodeAdded = originalOnNodeAdded || undefined
    graph.onNodeRemoved = originalOnNodeRemoved || undefined
    graph.onTrigger = originalOnTrigger || undefined
    graph.events.removeEventListener(
      'node:before-removed',
      beforeNodeRemovedListener
    )
    nodeDataStore.clearGraph(graph.id)
  }
}
