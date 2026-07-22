import { shallowReactive } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

import type {
  LGraph,
  LGraphNode,
  LGraphTriggerEvent
} from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'

const reactiveArrayNodes = new WeakSet<LGraphNode>()

/**
 * Renderer-side node lifecycle: seeds `layoutStore` on node add/remove and
 * grafts `shallowReactive` slot arrays onto live nodes so the Vue renderer
 * tracks slot mutations. Node shell state lives in the node-data store; there is
 * no secondary mirror here.
 */
export interface GraphNodeManager {
  getNode(id: NodeId): LGraphNode | undefined
  cleanup(): void
}

function makeReactiveNodeArrays(node: LGraphNode): {
  inputs: INodeInputSlot[]
  outputs: INodeOutputSlot[]
} {
  // Wrapping is one-shot: re-running would stack another getter layer per call.
  if (reactiveArrayNodes.has(node)) {
    return { inputs: node.inputs ?? [], outputs: node.outputs ?? [] }
  }
  reactiveArrayNodes.add(node)

  const existingWidgetsDescriptor = Object.getOwnPropertyDescriptor(
    node,
    'widgets'
  )
  const reactiveWidgets = shallowReactive<IBaseWidget[]>(node.widgets ?? [])
  if (existingWidgetsDescriptor?.get) {
    const originalGetter = existingWidgetsDescriptor.get
    Object.defineProperty(node, 'widgets', {
      get() {
        const current: IBaseWidget[] = originalGetter.call(node) ?? []
        if (
          current.length !== reactiveWidgets.length ||
          current.some((w, i) => w !== reactiveWidgets[i])
        ) {
          reactiveWidgets.splice(0, reactiveWidgets.length, ...current)
        }
        return reactiveWidgets
      },
      set: existingWidgetsDescriptor.set ?? (() => {}),
      configurable: true,
      enumerable: true
    })
  } else {
    Object.defineProperty(node, 'widgets', {
      get() {
        return reactiveWidgets
      },
      set(v) {
        reactiveWidgets.splice(0, reactiveWidgets.length, ...v)
      },
      configurable: true,
      enumerable: true
    })
  }

  const reactiveInputs = shallowReactive<INodeInputSlot[]>(node.inputs ?? [])
  Object.defineProperty(node, 'inputs', {
    get() {
      return reactiveInputs
    },
    set(v) {
      reactiveInputs.splice(0, reactiveInputs.length, ...v)
    },
    configurable: true,
    enumerable: true
  })

  const reactiveOutputs = shallowReactive<INodeOutputSlot[]>(node.outputs ?? [])
  Object.defineProperty(node, 'outputs', {
    get() {
      return reactiveOutputs
    },
    set(v) {
      reactiveOutputs.splice(0, reactiveOutputs.length, ...v)
    },
    configurable: true,
    enumerable: true
  })

  return { inputs: reactiveInputs, outputs: reactiveOutputs }
}

export function useGraphNodeManager(graph: LGraph): GraphNodeManager {
  const { createNode, deleteNode, setSource } = useLayoutMutations()
  const nodeRefs = new Map<NodeId, LGraphNode>()

  const getNode = (id: NodeId): LGraphNode | undefined => nodeRefs.get(id)

  const handleNodeAdded = (
    node: LGraphNode,
    originalCallback?: (node: LGraphNode) => void
  ) => {
    const id = node.id

    nodeRefs.set(id, node)
    makeReactiveNodeArrays(node)

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
          makeReactiveNodeArrays(node)
          initializeVueNodeLayout()
        }
      )
    } else {
      initializeVueNodeLayout()
    }

    if (originalCallback) {
      void originalCallback(node)
    }
  }

  const dropNodeReferences = (id: NodeId) => {
    nodeRefs.delete(id)
  }

  const handleNodeRemoved = (
    node: LGraphNode,
    originalCallback?: (node: LGraphNode) => void
  ) => {
    const id = node.id

    setSource(LayoutSource.Canvas)
    deleteNode(id)
    dropNodeReferences(id)
    originalCallback?.(node)
  }

  const createCleanupFunction = (
    originalOnNodeAdded: ((node: LGraphNode) => void) | undefined,
    originalOnNodeRemoved: ((node: LGraphNode) => void) | undefined,
    originalOnTrigger: ((event: LGraphTriggerEvent) => void) | undefined,
    beforeNodeRemovedListener: (e: CustomEvent<{ node: LGraphNode }>) => void
  ) => {
    return () => {
      graph.onNodeAdded = originalOnNodeAdded || undefined
      graph.onNodeRemoved = originalOnNodeRemoved || undefined
      graph.onTrigger = originalOnTrigger || undefined

      graph.events.removeEventListener(
        'node:before-removed',
        beforeNodeRemovedListener
      )

      nodeRefs.clear()
    }
  }

  const setupEventListeners = (): (() => void) => {
    const originalOnNodeAdded = graph.onNodeAdded
    const originalOnNodeRemoved = graph.onNodeRemoved
    const originalOnTrigger = graph.onTrigger

    graph.onNodeAdded = (node: LGraphNode) => {
      handleNodeAdded(node, originalOnNodeAdded)
    }

    graph.onNodeRemoved = (node: LGraphNode) => {
      handleNodeRemoved(node, originalOnNodeRemoved)
    }

    const beforeNodeRemovedListener = (
      e: CustomEvent<{ node: LGraphNode }>
    ) => {
      dropNodeReferences(e.detail.node.id)
    }
    graph.events.addEventListener(
      'node:before-removed',
      beforeNodeRemovedListener
    )

    graph.onTrigger = (event: LGraphTriggerEvent) => {
      if (event.type === 'node:slot-label:changed') {
        const nodeRef = nodeRefs.get(toNodeId(event.nodeId))
        if (nodeRef) {
          if (event.slotType !== NodeSlotType.OUTPUT && nodeRef.inputs) {
            nodeRef.inputs = [...nodeRef.inputs]
          }
          if (event.slotType !== NodeSlotType.INPUT && nodeRef.outputs) {
            nodeRef.outputs = [...nodeRef.outputs]
          }
        }
      }

      originalOnTrigger?.(event)
    }

    return createCleanupFunction(
      originalOnNodeAdded || undefined,
      originalOnNodeRemoved || undefined,
      originalOnTrigger || undefined,
      beforeNodeRemovedListener
    )
  }

  const cleanup = setupEventListeners()

  if (graph._nodes && graph._nodes.length > 0) {
    graph._nodes.forEach((node: LGraphNode) => {
      if (graph.onNodeAdded) {
        graph.onNodeAdded(node)
      }
    })
  }

  return {
    getNode,
    cleanup
  }
}
