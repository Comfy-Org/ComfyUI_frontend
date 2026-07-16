import { reactive, shallowReactive } from 'vue'

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
  LGraphTriggerAction,
  LGraphTriggerEvent,
  LGraphTriggerParam
} from '@/lib/litegraph/src/litegraph'
import type { TitleMode } from '@/lib/litegraph/src/types/globalEnums'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'

const reactiveArrayNodes = new WeakSet<LGraphNode>()

export interface VueNodeData {
  executing: boolean
  id: NodeId
  mode: number
  selected: boolean
  title: string
  type: string
  apiNode?: boolean
  bgcolor?: string
  color?: string
  flags?: {
    collapsed?: boolean
    ghost?: boolean
    pinned?: boolean
  }
  hasErrors?: boolean
  inputs?: INodeInputSlot[]
  outputs?: INodeOutputSlot[]
  resizable?: boolean
  shape?: number
  showAdvanced?: boolean
  subgraphId?: string | null
  titleMode?: TitleMode
}

export interface GraphNodeManager {
  vueNodeData: ReadonlyMap<NodeId, VueNodeData>
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

export function extractVueNodeData(node: LGraphNode): VueNodeData {
  const subgraphId =
    node.graph && 'id' in node.graph && node.graph !== node.graph.rootGraph
      ? String(node.graph.id)
      : null

  const { inputs, outputs } = makeReactiveNodeArrays(node)
  const nodeType =
    node.type ||
    node.constructor?.comfyClass ||
    node.constructor?.title ||
    node.constructor?.name ||
    'Unknown'

  return {
    id: node.id,
    title: typeof node.title === 'string' ? node.title : '',
    type: nodeType,
    mode: node.mode || 0,
    titleMode: node.title_mode,
    selected: node.selected || false,
    executing: false,
    subgraphId,
    apiNode: node.constructor?.nodeData?.api_node ?? false,
    hasErrors: !!node.has_errors,
    inputs,
    outputs,
    flags: node.flags ? { ...node.flags } : undefined,
    color: node.color || undefined,
    bgcolor: node.bgcolor || undefined,
    resizable: node.resizable,
    shape: node.shape,
    showAdvanced: node.showAdvanced
  }
}

export function useGraphNodeManager(graph: LGraph): GraphNodeManager {
  const { createNode, deleteNode, setSource } = useLayoutMutations()
  const vueNodeData = reactive(new Map<NodeId, VueNodeData>())
  const nodeRefs = new Map<NodeId, LGraphNode>()

  const getNode = (id: NodeId): LGraphNode | undefined => nodeRefs.get(id)

  const syncWithGraph = () => {
    if (!graph?._nodes) return

    const currentNodes = new Set(graph._nodes.map((n) => n.id))

    for (const id of Array.from(vueNodeData.keys())) {
      if (!currentNodes.has(id)) {
        nodeRefs.delete(id)
        vueNodeData.delete(id)
      }
    }

    graph._nodes.forEach((node) => {
      const id = node.id
      nodeRefs.set(id, node)
      vueNodeData.set(id, extractVueNodeData(node))
    })
  }

  const handleNodeAdded = (
    node: LGraphNode,
    originalCallback?: (node: LGraphNode) => void
  ) => {
    const id = node.id

    nodeRefs.set(id, node)
    vueNodeData.set(id, extractVueNodeData(node))

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
          vueNodeData.set(id, extractVueNodeData(node))
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
    vueNodeData.delete(id)
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
      vueNodeData.clear()
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

    const triggerHandlers: {
      [K in LGraphTriggerAction]: (event: LGraphTriggerParam<K>) => void
    } = {
      'node:property:changed': (propertyEvent) => {
        const nodeId = toNodeId(propertyEvent.nodeId)
        const currentData = vueNodeData.get(nodeId)

        if (currentData) {
          switch (propertyEvent.property) {
            case 'title':
              vueNodeData.set(nodeId, {
                ...currentData,
                title: String(propertyEvent.newValue)
              })
              break
            case 'has_errors':
              vueNodeData.set(nodeId, {
                ...currentData,
                hasErrors: Boolean(propertyEvent.newValue)
              })
              break
            case 'flags.collapsed':
              vueNodeData.set(nodeId, {
                ...currentData,
                flags: {
                  ...currentData.flags,
                  collapsed: Boolean(propertyEvent.newValue)
                }
              })
              break
            case 'flags.ghost':
              vueNodeData.set(nodeId, {
                ...currentData,
                flags: {
                  ...currentData.flags,
                  ghost: Boolean(propertyEvent.newValue)
                }
              })
              break
            case 'flags.pinned':
              vueNodeData.set(nodeId, {
                ...currentData,
                flags: {
                  ...currentData.flags,
                  pinned: Boolean(propertyEvent.newValue)
                }
              })
              break
            case 'mode':
              vueNodeData.set(nodeId, {
                ...currentData,
                mode:
                  typeof propertyEvent.newValue === 'number'
                    ? propertyEvent.newValue
                    : 0
              })
              break
            case 'color':
              vueNodeData.set(nodeId, {
                ...currentData,
                color:
                  typeof propertyEvent.newValue === 'string'
                    ? propertyEvent.newValue
                    : undefined
              })
              break
            case 'bgcolor':
              vueNodeData.set(nodeId, {
                ...currentData,
                bgcolor:
                  typeof propertyEvent.newValue === 'string'
                    ? propertyEvent.newValue
                    : undefined
              })
              break
            case 'shape':
              vueNodeData.set(nodeId, {
                ...currentData,
                shape:
                  typeof propertyEvent.newValue === 'number'
                    ? propertyEvent.newValue
                    : undefined
              })
              break
            case 'showAdvanced':
              vueNodeData.set(nodeId, {
                ...currentData,
                showAdvanced: Boolean(propertyEvent.newValue)
              })
              break
          }
        }
      },
      'node:slot-label:changed': (slotLabelEvent) => {
        const nodeId = toNodeId(slotLabelEvent.nodeId)
        const nodeRef = nodeRefs.get(nodeId)
        if (!nodeRef) return

        if (slotLabelEvent.slotType !== NodeSlotType.OUTPUT && nodeRef.inputs) {
          nodeRef.inputs = [...nodeRef.inputs]
        }
        if (slotLabelEvent.slotType !== NodeSlotType.INPUT && nodeRef.outputs) {
          nodeRef.outputs = [...nodeRef.outputs]
        }
      }
    }

    graph.onTrigger = (event: LGraphTriggerEvent) => {
      switch (event.type) {
        case 'node:property:changed':
          triggerHandlers['node:property:changed'](event)
          break
        case 'node:slot-label:changed':
          triggerHandlers['node:slot-label:changed'](event)
          break
      }

      originalOnTrigger?.(event)
    }

    syncWithGraph()

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
    vueNodeData,
    getNode,
    cleanup
  }
}
