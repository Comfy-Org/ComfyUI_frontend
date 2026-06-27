import { useChainCallback } from '@/composables/functional/useChainCallback'
import type {
  LGraph,
  LGraphNode,
  LGraphTriggerEvent
} from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import {
  buildSlotMetadata,
  extractVueNodeData,
  installReactiveNodeArrays
} from '@/renderer/extensions/vueNodes/utils/nodeDataExtraction'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import type { Badges } from '@/types/nodeData'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

export function useGraphNodeManager(graph: LGraph): () => void {
  const { createNode, deleteNode, setSource } = useLayoutMutations()
  const nodeDataStore = useNodeDataStore()
  const nodeRefs = new Map<NodeId, LGraphNode>()

  const refreshNodeSlots = (nodeId: NodeId) => {
    const nodeRef = nodeRefs.get(nodeId)
    const currentData = nodeDataStore.getNodeData(graph.id, nodeId)
    if (!nodeRef || !currentData) return

    const slotMetadata = buildSlotMetadata(nodeRef.inputs, graph)
    for (const widget of currentData.widgets ?? []) {
      widget.slotMetadata = slotMetadata.get(widget.name)
    }
  }

  const upsertNodeData = (node: LGraphNode) => {
    installReactiveNodeArrays(node)
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
        nodeRefs.delete(id)
        nodeDataStore.deleteNodeData(graph.id, id)
      }
    }

    graph._nodes.forEach((node) => {
      nodeRefs.set(node.id, node)
      upsertNodeData(node)
    })
  }

  const handleNodeAdded = (
    node: LGraphNode,
    originalCallback?: (node: LGraphNode) => void
  ) => {
    const id = node.id
    nodeRefs.set(id, node)
    upsertNodeData(node)

    const initializeVueNodeLayout = () => {
      if (!nodeRefs.has(id)) return

      const existingLayout = layoutStore.getNodeLayoutRef(id).value
      if (existingLayout) return

      setSource(LayoutSource.Canvas)
      void createNode(id, {
        position: { x: node.pos[0], y: node.pos[1] },
        size: { width: node.size[0], height: node.size[1] },
        zIndex: node.order || 0,
        visible: true
      })
    }

    if (window.app?.configuringGraph) {
      node.onAfterGraphConfigured = useChainCallback(
        node.onAfterGraphConfigured,
        () => {
          upsertNodeData(node)
          initializeVueNodeLayout()
        }
      )
    } else {
      initializeVueNodeLayout()
    }

    originalCallback?.(node)
  }

  const dropNodeReferences = (id: NodeId) => {
    nodeRefs.delete(id)
    nodeDataStore.deleteNodeData(graph.id, id)
  }

  const handleNodeRemoved = (
    node: LGraphNode,
    originalCallback?: (node: LGraphNode) => void
  ) => {
    setSource(LayoutSource.Canvas)
    void deleteNode(node.id)
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
      case 'node:property:changed': {
        const nodeId = toNodeId(event.nodeId)
        const currentData = nodeDataStore.getNodeData(graph.id, nodeId)
        if (!currentData) break

        switch (event.property) {
          case 'title':
            nodeDataStore.patchNodeData(graph.id, nodeId, {
              title: String(event.newValue)
            })
            break
          case 'has_errors':
            nodeDataStore.patchNodeData(graph.id, nodeId, {
              hasErrors: Boolean(event.newValue)
            })
            break
          case 'flags.collapsed':
            nodeDataStore.patchNodeData(graph.id, nodeId, {
              flags: {
                ...currentData.flags,
                collapsed: Boolean(event.newValue)
              }
            })
            break
          case 'flags.ghost':
            nodeDataStore.patchNodeData(graph.id, nodeId, {
              flags: {
                ...currentData.flags,
                ghost: Boolean(event.newValue)
              }
            })
            break
          case 'flags.pinned':
            nodeDataStore.patchNodeData(graph.id, nodeId, {
              flags: {
                ...currentData.flags,
                pinned: Boolean(event.newValue)
              }
            })
            break
          case 'mode':
            nodeDataStore.patchNodeData(graph.id, nodeId, {
              mode: typeof event.newValue === 'number' ? event.newValue : 0
            })
            break
          case 'color':
            nodeDataStore.patchNodeData(graph.id, nodeId, {
              color:
                typeof event.newValue === 'string' ? event.newValue : undefined
            })
            break
          case 'bgcolor':
            nodeDataStore.patchNodeData(graph.id, nodeId, {
              bgcolor:
                typeof event.newValue === 'string' ? event.newValue : undefined
            })
            break
          case 'shape':
            nodeDataStore.patchNodeData(graph.id, nodeId, {
              shape:
                typeof event.newValue === 'number' ? event.newValue : undefined
            })
            break
          case 'showAdvanced':
            nodeDataStore.patchNodeData(graph.id, nodeId, {
              showAdvanced: Boolean(event.newValue)
            })
            break
          case 'badges':
            nodeDataStore.patchNodeData(graph.id, nodeId, {
              badges: event.newValue as Badges
            })
            break
        }
        break
      }
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
        const nodeRef = nodeRefs.get(nodeId)
        if (!nodeRef) break

        if (event.slotType !== NodeSlotType.OUTPUT && nodeRef.inputs) {
          nodeRef.inputs = [...nodeRef.inputs]
        }
        if (event.slotType !== NodeSlotType.INPUT && nodeRef.outputs) {
          nodeRef.outputs = [...nodeRef.outputs]
        }
        upsertNodeData(nodeRef)
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
    nodeRefs.clear()
    nodeDataStore.clearGraph(graph.id)
  }
}
