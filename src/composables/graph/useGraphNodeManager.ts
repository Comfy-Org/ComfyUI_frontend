/**
 * Vue node lifecycle management for LiteGraph integration
 * Provides event-driven reactivity with performance optimizations
 */
import { reactiveComputed } from '@vueuse/core'
import { customRef, reactive, shallowReactive } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { isProxyWidget } from '@/core/graph/subgraph/proxyWidget'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { NodeId } from '@/renderer/core/layout/types'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { isDOMWidget } from '@/scripts/domWidget'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { WidgetValue, SafeControlWidget } from '@/types/simplifiedWidget'
import { normalizeControlOption } from '@/types/simplifiedWidget'

import type {
  LGraph,
  LGraphBadge,
  LGraphNode,
  LGraphTriggerAction,
  LGraphTriggerEvent,
  LGraphTriggerParam
} from '@/lib/litegraph/src/litegraph'
import type { TitleMode } from '@/lib/litegraph/src/types/globalEnums'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'

export interface WidgetSlotMetadata {
  index: number
  linked: boolean
}

export interface SafeWidgetData {
  name: string
  type: string
  value: WidgetValue
  borderStyle?: string
  callback?: ((value: unknown) => void) | undefined
  controlWidget?: SafeControlWidget
  isDOMWidget?: boolean
  label?: string
  nodeType?: string
  options?: IWidgetOptions<unknown>
  spec?: InputSpec
  slotMetadata?: WidgetSlotMetadata
}

export interface VueNodeData {
  executing: boolean
  id: NodeId
  mode: number
  selected: boolean
  title: string
  type: string
  apiNode?: boolean
  badges?: (LGraphBadge | (() => LGraphBadge))[]
  bgcolor?: string
  color?: string
  flags?: {
    collapsed?: boolean
    pinned?: boolean
  }
  hasErrors?: boolean
  inputs?: INodeInputSlot[]
  outputs?: INodeOutputSlot[]
  shape?: number
  subgraphId?: string | null
  titleMode?: TitleMode
  widgets?: SafeWidgetData[]
}

export interface GraphNodeManager {
  // Reactive state - safe data extracted from LiteGraph nodes
  vueNodeData: ReadonlyMap<string, VueNodeData>

  // Access to original LiteGraph nodes (non-reactive)
  getNode(id: string): LGraphNode | undefined

  // Lifecycle methods
  cleanup(): void
}

function widgetWithVueTrack(
  widget: IBaseWidget
): asserts widget is IBaseWidget & { vueTrack: () => void } {
  if (widget.vueTrack) return

  customRef((track, trigger) => {
    widget.callback = useChainCallback(widget.callback, trigger)
    widget.vueTrack = track
    return { get() {}, set() {} }
  })
}
export function useReactiveWidgetValue(widget: IBaseWidget) {
  widgetWithVueTrack(widget)
  widget.vueTrack()
  return widget.value
}

function getControlWidget(widget: IBaseWidget): SafeControlWidget | undefined {
  const cagWidget = widget.linkedWidgets?.find(
    (w) => w.name == 'control_after_generate'
  )
  if (!cagWidget) return
  return {
    value: normalizeControlOption(cagWidget.value),
    update: (value) => (cagWidget.value = normalizeControlOption(value))
  }
}
function getNodeType(node: LGraphNode, widget: IBaseWidget) {
  if (!node.isSubgraphNode() || !isProxyWidget(widget)) return undefined
  const subNode = node.subgraph.getNodeById(widget._overlay.nodeId)
  return subNode?.type
}

/**
 * Validates that a value is a valid WidgetValue type
 */
const normalizeWidgetValue = (value: unknown): WidgetValue => {
  if (value === null || value === undefined || value === void 0) {
    return undefined
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value === 'object') {
    // Check if it's a File array
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((item): item is File => item instanceof File)
    ) {
      return value
    }
    // Otherwise it's a generic object
    return value
  }
  // If none of the above, return undefined
  console.warn(`Invalid widget value type: ${typeof value}`, value)
  return undefined
}

export function safeWidgetMapper(
  node: LGraphNode,
  slotMetadata: Map<string, WidgetSlotMetadata>
): (widget: IBaseWidget) => SafeWidgetData {
  const nodeDefStore = useNodeDefStore()
  return function (widget) {
    try {
      const spec = nodeDefStore.getInputSpecForWidget(node, widget.name)
      const slotInfo = slotMetadata.get(widget.name)
      const borderStyle = widget.promoted
        ? 'ring ring-component-node-widget-promoted'
        : widget.advanced
          ? 'ring ring-component-node-widget-advanced'
          : undefined
      const callback = (v: unknown) => {
        const value = normalizeWidgetValue(v)
        widget.value = value ?? undefined
        widget.callback?.(value)
      }

      return {
        name: widget.name,
        type: widget.type,
        value: useReactiveWidgetValue(widget),
        borderStyle,
        callback,
        controlWidget: getControlWidget(widget),
        isDOMWidget: isDOMWidget(widget),
        label: widget.label,
        nodeType: getNodeType(node, widget),
        options: widget.options,
        spec,
        slotMetadata: slotInfo
      }
    } catch (error) {
      return {
        name: widget.name || 'unknown',
        type: widget.type || 'text',
        value: undefined
      }
    }
  }
}

export function isValidWidgetValue(value: unknown): value is WidgetValue {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'object'
  )
}

export function useGraphNodeManager(graph: LGraph): GraphNodeManager {
  // Get layout mutations composable
  const { createNode, deleteNode, setSource } = useLayoutMutations()
  // Safe reactive data extracted from LiteGraph nodes
  const vueNodeData = reactive(new Map<string, VueNodeData>())

  // Non-reactive storage for original LiteGraph nodes
  const nodeRefs = new Map<string, LGraphNode>()

  const refreshNodeSlots = (nodeId: string) => {
    const nodeRef = nodeRefs.get(nodeId)
    const currentData = vueNodeData.get(nodeId)

    if (!nodeRef || !currentData) return

    // Only extract slot-related data instead of full node re-extraction
    const slotMetadata = new Map<string, WidgetSlotMetadata>()

    nodeRef.inputs?.forEach((input, index) => {
      if (!input?.widget?.name) return
      slotMetadata.set(input.widget.name, {
        index,
        linked: input.link != null
      })
    })

    // Update only widgets with new slot metadata, keeping other widget data intact
    const updatedWidgets = currentData.widgets?.map((widget) => {
      const slotInfo = slotMetadata.get(widget.name)
      return slotInfo ? { ...widget, slotMetadata: slotInfo } : widget
    })

    vueNodeData.set(nodeId, {
      ...currentData,
      widgets: updatedWidgets,
      inputs: nodeRef.inputs ? [...nodeRef.inputs] : undefined,
      outputs: nodeRef.outputs ? [...nodeRef.outputs] : undefined
    })
  }

  // Extract safe data from LiteGraph node for Vue consumption
  function extractVueNodeData(node: LGraphNode): VueNodeData {
    // Determine subgraph ID - null for root graph, string for subgraphs
    const subgraphId =
      node.graph && 'id' in node.graph && node.graph !== node.graph.rootGraph
        ? String(node.graph.id)
        : null
    // Extract safe widget data
    const slotMetadata = new Map<string, WidgetSlotMetadata>()

    const reactiveWidgets = shallowReactive<IBaseWidget[]>(node.widgets ?? [])
    Object.defineProperty(node, 'widgets', {
      get() {
        return reactiveWidgets
      },
      set(v) {
        reactiveWidgets.splice(0, reactiveWidgets.length, ...v)
      }
    })
    const reactiveInputs = shallowReactive<INodeInputSlot[]>(node.inputs ?? [])
    Object.defineProperty(node, 'inputs', {
      get() {
        return reactiveInputs
      },
      set(v) {
        reactiveInputs.splice(0, reactiveInputs.length, ...v)
      }
    })

    const safeWidgets = reactiveComputed<SafeWidgetData[]>(() => {
      node.inputs?.forEach((input, index) => {
        if (!input?.widget?.name) return
        slotMetadata.set(input.widget.name, {
          index,
          linked: input.link != null
        })
      })
      return node.widgets?.map(safeWidgetMapper(node, slotMetadata)) ?? []
    })

    const nodeType =
      node.type ||
      node.constructor?.comfyClass ||
      node.constructor?.title ||
      node.constructor?.name ||
      'Unknown'

    const apiNode = node.constructor?.nodeData?.api_node ?? false
    const badges = node.badges

    return {
      id: String(node.id),
      title: typeof node.title === 'string' ? node.title : '',
      type: nodeType,
      mode: node.mode || 0,
      titleMode: node.title_mode,
      selected: node.selected || false,
      executing: false, // Will be updated separately based on execution state
      subgraphId,
      apiNode,
      badges,
      hasErrors: !!node.has_errors,
      widgets: safeWidgets,
      inputs: reactiveInputs,
      outputs: node.outputs ? [...node.outputs] : undefined,
      flags: node.flags ? { ...node.flags } : undefined,
      color: node.color || undefined,
      bgcolor: node.bgcolor || undefined,
      shape: node.shape
    }
  }

  // Get access to original LiteGraph node (non-reactive)
  const getNode = (id: string): LGraphNode | undefined => {
    return nodeRefs.get(id)
  }

  const syncWithGraph = () => {
    if (!graph?._nodes) return

    const currentNodes = new Set(graph._nodes.map((n) => String(n.id)))

    // Remove deleted nodes
    for (const id of Array.from(vueNodeData.keys())) {
      if (!currentNodes.has(id)) {
        nodeRefs.delete(id)
        vueNodeData.delete(id)
      }
    }

    // Add/update existing nodes
    graph._nodes.forEach((node) => {
      const id = String(node.id)

      // Store non-reactive reference
      nodeRefs.set(id, node)

      // Extract and store safe data for Vue
      vueNodeData.set(id, extractVueNodeData(node))
    })
  }

  /**
   * Handles node addition to the graph - sets up Vue state and spatial indexing
   * Defers position extraction until after potential configure() calls
   */
  const handleNodeAdded = (
    node: LGraphNode,
    originalCallback?: (node: LGraphNode) => void
  ) => {
    const id = String(node.id)

    // Store non-reactive reference to original node
    nodeRefs.set(id, node)

    // Extract initial data for Vue (may be incomplete during graph configure)
    vueNodeData.set(id, extractVueNodeData(node))

    const initializeVueNodeLayout = () => {
      // Extract actual positions after configure() has potentially updated them
      const nodePosition = { x: node.pos[0], y: node.pos[1] }
      const nodeSize = { width: node.size[0], height: node.size[1] }

      // Add node to layout store with final positions
      setSource(LayoutSource.Canvas)
      void createNode(id, {
        position: nodePosition,
        size: nodeSize,
        zIndex: node.order || 0,
        visible: true
      })
    }

    // Check if we're in the middle of configuring the graph (workflow loading)
    if (window.app?.configuringGraph) {
      // During workflow loading - defer layout initialization until configure completes
      // Chain our callback with any existing onAfterGraphConfigured callback
      node.onAfterGraphConfigured = useChainCallback(
        node.onAfterGraphConfigured,
        () => {
          // Re-extract data now that configure() has populated title/slots/widgets/etc.
          vueNodeData.set(id, extractVueNodeData(node))
          initializeVueNodeLayout()
        }
      )
    } else {
      // Not during workflow loading - initialize layout immediately
      // This handles individual node additions during normal operation
      initializeVueNodeLayout()
    }

    // Call original callback if provided
    if (originalCallback) {
      void originalCallback(node)
    }
  }

  /**
   * Handles node removal from the graph - cleans up all references
   */
  const handleNodeRemoved = (
    node: LGraphNode,
    originalCallback?: (node: LGraphNode) => void
  ) => {
    const id = String(node.id)

    // Remove node from layout store
    setSource(LayoutSource.Canvas)
    void deleteNode(id)

    // Clean up all tracking references
    nodeRefs.delete(id)
    vueNodeData.delete(id)

    // Call original callback if provided
    if (originalCallback) {
      originalCallback(node)
    }
  }

  /**
   * Creates cleanup function for event listeners and state
   */
  const createCleanupFunction = (
    originalOnNodeAdded: ((node: LGraphNode) => void) | undefined,
    originalOnNodeRemoved: ((node: LGraphNode) => void) | undefined,
    originalOnTrigger: ((event: LGraphTriggerEvent) => void) | undefined
  ) => {
    return () => {
      // Restore original callbacks
      graph.onNodeAdded = originalOnNodeAdded || undefined
      graph.onNodeRemoved = originalOnNodeRemoved || undefined
      graph.onTrigger = originalOnTrigger || undefined

      // Clear all state maps
      nodeRefs.clear()
      vueNodeData.clear()
    }
  }

  /**
   * Sets up event listeners - now simplified with extracted handlers
   */
  const setupEventListeners = (): (() => void) => {
    // Store original callbacks
    const originalOnNodeAdded = graph.onNodeAdded
    const originalOnNodeRemoved = graph.onNodeRemoved
    const originalOnTrigger = graph.onTrigger

    // Set up graph event handlers
    graph.onNodeAdded = (node: LGraphNode) => {
      handleNodeAdded(node, originalOnNodeAdded)
    }

    graph.onNodeRemoved = (node: LGraphNode) => {
      handleNodeRemoved(node, originalOnNodeRemoved)
    }

    const triggerHandlers: {
      [K in LGraphTriggerAction]: (event: LGraphTriggerParam<K>) => void
    } = {
      'node:property:changed': (propertyEvent) => {
        const nodeId = String(propertyEvent.nodeId)
        const currentData = vueNodeData.get(nodeId)

        if (currentData) {
          switch (propertyEvent.property) {
            case 'title':
              vueNodeData.set(nodeId, {
                ...currentData,
                title: String(propertyEvent.newValue)
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
          }
        }
      },
      'node:slot-errors:changed': (slotErrorsEvent) => {
        refreshNodeSlots(String(slotErrorsEvent.nodeId))
      },
      'node:slot-links:changed': (slotLinksEvent) => {
        if (slotLinksEvent.slotType === NodeSlotType.INPUT) {
          refreshNodeSlots(String(slotLinksEvent.nodeId))
        }
      }
    }

    graph.onTrigger = (event: LGraphTriggerEvent) => {
      switch (event.type) {
        case 'node:property:changed':
          triggerHandlers['node:property:changed'](event)
          break
        case 'node:slot-errors:changed':
          triggerHandlers['node:slot-errors:changed'](event)
          break
        case 'node:slot-links:changed':
          triggerHandlers['node:slot-links:changed'](event)
          break
      }

      // Chain to original handler
      originalOnTrigger?.(event)
    }

    // Initialize state
    syncWithGraph()

    // Return cleanup function
    return createCleanupFunction(
      originalOnNodeAdded || undefined,
      originalOnNodeRemoved || undefined,
      originalOnTrigger || undefined
    )
  }

  // Set up event listeners immediately
  const cleanup = setupEventListeners()

  // Process any existing nodes after event listeners are set up
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
