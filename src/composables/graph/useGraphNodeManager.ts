/**
 * Vue node lifecycle management for LiteGraph integration
 * Provides event-driven reactivity with performance optimizations
 */
import { reactiveComputed } from '@vueuse/core'
import cloneDeep from 'es-toolkit/compat/cloneDeep'
import { reactive, shallowReactive } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { promotedInputWidgets } from '@/core/graph/subgraph/promotedInputWidget'
import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
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
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { isDOMWidget } from '@/scripts/domWidget'
import { IS_CONTROL_WIDGET } from '@/scripts/widgets'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetValue, SafeControlWidget } from '@/types/simplifiedWidget'
import { normalizeControlOption } from '@/types/simplifiedWidget'
import { getWidgetIdForNode } from '@/utils/litegraphUtil'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import type { WidgetId } from '@/types/widgetId'

import type {
  LGraph,
  LGraphBadge,
  LGraphNode,
  LGraphTriggerAction,
  LGraphTriggerEvent,
  LGraphTriggerParam,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type { TitleMode } from '@/lib/litegraph/src/types/globalEnums'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import { app } from '@/scripts/app'

export interface WidgetSlotMetadata {
  index: number
  linked: boolean
  originNodeId?: NodeId
  originOutputName?: string
  type: string
}

type Badges = (LGraphBadge | (() => LGraphBadge))[]

/**
 * Minimal render-specific widget data extracted from LiteGraph widgets.
 * Value and metadata (label, hidden, disabled, etc.) are accessed via widgetValueStore.
 */
export interface SafeWidgetData {
  widgetId?: WidgetId
  nodeId?: NodeId
  name: string
  type: string
  /** Callback to invoke when widget value changes (wraps LiteGraph callback + triggerDraw) */
  callback?: ((value: unknown) => void) | undefined
  /** Control widget for seed randomization/increment/decrement */
  controlWidget?: SafeControlWidget
  /** Whether widget has custom layout size computation */
  hasLayoutSize?: boolean
  /** Whether widget is a DOM widget */
  isDOMWidget?: boolean
  /**
   * Widget options needed for render decisions.
   * Note: Most metadata should be accessed via widgetValueStore.getWidget().
   */
  options?: {
    canvasOnly?: boolean
    advanced?: boolean
    hidden?: boolean
    read_only?: boolean
    values?: unknown
  }
  /** Input specification from node definition */
  spec?: InputSpec
  /** Input slot metadata (index and link status) */
  slotMetadata?: WidgetSlotMetadata
  /**
   * Execution ID of the interior node that owns the source widget.
   * Only set for promoted widgets where the source node differs from the host
   * subgraph node. Retained for source-scoped validation errors.
   */
  sourceExecutionId?: NodeExecutionId
  /**
   * Interior source widget name. Only set for promoted widgets, where `name` is
   * the host input slot name and the source widget name can differ.
   */
  sourceWidgetName?: string
  /** Tooltip text from the resolved widget. */
  tooltip?: string
}

export interface VueNodeData {
  executing: boolean
  id: NodeId
  mode: number
  selected: boolean
  title: string
  type: string
  apiNode?: boolean
  badges?: Badges
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
  widgets?: SafeWidgetData[]
}

export interface GraphNodeManager {
  // Reactive state - safe data extracted from LiteGraph nodes
  vueNodeData: ReadonlyMap<NodeId, VueNodeData>

  // Access to original LiteGraph nodes (non-reactive)
  getNode(id: NodeId): LGraphNode | undefined

  // Lifecycle methods
  cleanup(): void
}

export function getControlWidget(
  widget: IBaseWidget
): SafeControlWidget | undefined {
  const cagWidget = widget.linkedWidgets?.find((w) => w[IS_CONTROL_WIDGET])
  if (!cagWidget) return
  return {
    value: normalizeControlOption(cagWidget.value),
    update: (value) => (cagWidget.value = normalizeControlOption(value))
  }
}

interface SharedWidgetEnhancements {
  controlWidget?: SafeControlWidget
  spec?: InputSpec
}

function getSharedWidgetEnhancements(
  node: LGraphNode,
  widget: IBaseWidget
): SharedWidgetEnhancements {
  const nodeDefStore = useNodeDefStore()

  return {
    controlWidget: getControlWidget(widget),
    spec: nodeDefStore.getInputSpecForWidget(node, widget.name)
  }
}

/**
 * Validates that a value is a valid WidgetValue type
 */
function normalizeWidgetValue(value: unknown): WidgetValue {
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

function extractWidgetDisplayOptions(
  widget: IBaseWidget
): SafeWidgetData['options'] {
  if (!widget.options) return undefined

  return {
    canvasOnly: widget.options.canvasOnly,
    advanced: widget.options?.advanced ?? widget.advanced,
    hidden: widget.options.hidden,
    read_only: widget.options.read_only
  }
}

function isDOMBackedWidget(widget: IBaseWidget): boolean {
  return (
    ('element' in widget && !!widget.element) ||
    ('component' in widget && !!widget.component)
  )
}

interface PromotedWidgetMetadata {
  controlWidget?: SafeControlWidget
  isDOMWidget: boolean
  sourceExecutionId?: NodeExecutionId
  sourceWidgetName?: string
}

/**
 * Resolves the interior source of a promoted subgraph input to derive the
 * metadata that backend lookups key by (execution ID, interior widget name)
 * plus the source widget's control + DOM nature. Also seeds host widget state
 * if it is somehow missing. Returns undefined when the widget is not promoted.
 */
function resolvePromotedMetadata(
  node: SubgraphNode,
  widget: IBaseWidget
): PromotedWidgetMetadata | undefined {
  const source = resolvePromotedWidgetSource(app.rootGraph, node, widget)
  if (!source) return undefined

  ensurePromotedHostWidgetState(
    source.input.widgetId,
    source.input,
    source.sourceWidget
  )

  return {
    controlWidget: getControlWidget(source.sourceWidget),
    isDOMWidget: isDOMBackedWidget(source.sourceWidget),
    sourceExecutionId: source.sourceExecutionId,
    sourceWidgetName: source.sourceWidgetName
  }
}

function safeWidgetMapper(
  node: LGraphNode,
  slotMetadata: Map<string, WidgetSlotMetadata>
): (widget: IBaseWidget) => SafeWidgetData {
  const duplicateIndexByKey = new Map<string, number>()

  return function (widget) {
    try {
      const duplicateKey = `${widget.name}:${widget.type}`
      const duplicateIndex = duplicateIndexByKey.get(duplicateKey) ?? 0
      duplicateIndexByKey.set(duplicateKey, duplicateIndex + 1)
      const slotInfo = slotMetadata.get(widget.name)

      // Wrapper callback specific to Nodes 2.0 rendering
      const callback = (v: unknown) => {
        const value = normalizeWidgetValue(v)
        widget.value = value ?? undefined
        // Match litegraph callback signature: (value, canvas, node, pos, event)
        // Some extensions (e.g., Impact Pack) expect node as the 3rd parameter
        widget.callback?.(value, app.canvas, node)
        // Trigger redraw for all legacy widgets on this node (e.g., mask preview)
        // This ensures widgets that depend on other widget values get updated
        node.widgets?.forEach((w) => w.triggerDraw?.())
      }

      const promoted = node.isSubgraphNode()
        ? resolvePromotedMetadata(node, widget)
        : undefined

      return {
        widgetId: getWidgetIdForNode(node, widget, duplicateIndex),
        name: widget.name,
        type: widget.type,
        ...getSharedWidgetEnhancements(node, widget),
        ...(promoted?.controlWidget && {
          controlWidget: promoted.controlWidget
        }),
        callback,
        hasLayoutSize: typeof widget.computeLayoutSize === 'function',
        isDOMWidget: promoted?.isDOMWidget ?? isDOMWidget(widget),
        options: extractWidgetDisplayOptions(widget),
        slotMetadata: slotInfo,
        sourceExecutionId: promoted?.sourceExecutionId,
        sourceWidgetName: promoted?.sourceWidgetName,
        tooltip: widget.tooltip
      }
    } catch (error) {
      console.warn(
        '[safeWidgetMapper] Failed to map widget:',
        widget.name,
        error
      )
      return {
        name: widget.name || 'unknown',
        type: widget.type || 'text'
      }
    }
  }
}

function ensurePromotedHostWidgetState(
  id: WidgetId,
  input: INodeInputSlot,
  sourceWidget: IBaseWidget | undefined
): void {
  if (!sourceWidget) return
  const store = useWidgetValueStore()
  if (store.getWidget(id)) return
  store.registerWidget(id, {
    type: sourceWidget.type,
    value: sourceWidget.value,
    options: cloneDeep(sourceWidget.options ?? {}),
    label: input.label ?? input.name,
    serialize: sourceWidget.serialize,
    disabled: sourceWidget.disabled
  })
}

function buildSlotMetadata(
  inputs: INodeInputSlot[] | undefined,
  graphRef: LGraph | null | undefined
): Map<string, WidgetSlotMetadata> {
  const metadata = new Map<string, WidgetSlotMetadata>()
  inputs?.forEach((input, index) => {
    let originNodeId: NodeId | undefined
    let originOutputName: string | undefined

    if (input.link != null && graphRef) {
      const link = graphRef.getLink(input.link)
      const originNode = link ? graphRef.getNodeById(link.origin_id) : null
      if (link && originNode) {
        originNodeId = link.origin_id
        originOutputName = originNode.outputs?.[link.origin_slot]?.name
      }
    }

    const slotInfo: WidgetSlotMetadata = {
      index,
      linked: input.link != null,
      originNodeId,
      originOutputName,
      type: String(input.type)
    }
    if (input.name) metadata.set(input.name, slotInfo)
    if (input.widget?.name) metadata.set(input.widget.name, slotInfo)
  })
  return metadata
}

// Extract safe data from LiteGraph node for Vue consumption
export function extractVueNodeData(node: LGraphNode): VueNodeData {
  // Determine subgraph ID - null for root graph, string for subgraphs
  const subgraphId =
    node.graph && 'id' in node.graph && node.graph !== node.graph.rootGraph
      ? String(node.graph.id)
      : null
  // Extract safe widget data
  const slotMetadata = new Map<string, WidgetSlotMetadata>()

  const existingWidgetsDescriptor = Object.getOwnPropertyDescriptor(
    node,
    'widgets'
  )
  const reactiveWidgets = shallowReactive<IBaseWidget[]>(node.widgets ?? [])
  if (existingWidgetsDescriptor?.get) {
    // Node has a custom widgets getter (e.g. SubgraphNode's synthetic getter).
    // Preserve it but sync results into a reactive array for Vue.
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

  const safeWidgets = reactiveComputed<SafeWidgetData[]>(() => {
    const freshMetadata = buildSlotMetadata(node.inputs, node.graph)
    slotMetadata.clear()
    for (const [key, value] of freshMetadata) {
      slotMetadata.set(key, value)
    }

    const widgets = node.isSubgraphNode()
      ? promotedInputWidgets(node)
      : (node.widgets ?? [])
    return widgets.map(safeWidgetMapper(node, slotMetadata))
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
    id: node.id,
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
    outputs: reactiveOutputs,
    flags: node.flags ? { ...node.flags } : undefined,
    color: node.color || undefined,
    bgcolor: node.bgcolor || undefined,
    resizable: node.resizable,
    shape: node.shape,
    showAdvanced: node.showAdvanced
  }
}

export function useGraphNodeManager(graph: LGraph): GraphNodeManager {
  // Get layout mutations composable
  const { createNode, deleteNode, setSource } = useLayoutMutations()
  // Safe reactive data extracted from LiteGraph nodes
  const vueNodeData = reactive(new Map<NodeId, VueNodeData>())

  // Non-reactive storage for original LiteGraph nodes
  const nodeRefs = new Map<NodeId, LGraphNode>()

  const refreshNodeSlots = (nodeId: NodeId) => {
    const nodeRef = nodeRefs.get(nodeId)
    const currentData = vueNodeData.get(nodeId)

    if (!nodeRef || !currentData) return

    const slotMetadata = buildSlotMetadata(nodeRef.inputs, graph)

    // Update only widgets with new slot metadata, keeping other widget data intact
    for (const widget of currentData.widgets ?? []) {
      widget.slotMetadata = slotMetadata.get(widget.name)
    }
  }

  // Get access to original LiteGraph node (non-reactive)
  const getNode = (id: NodeId): LGraphNode | undefined => {
    return nodeRefs.get(id)
  }

  const syncWithGraph = () => {
    if (!graph?._nodes) return

    const currentNodes = new Set(graph._nodes.map((n) => n.id))

    // Remove deleted nodes
    for (const id of Array.from(vueNodeData.keys())) {
      if (!currentNodes.has(id)) {
        nodeRefs.delete(id)
        vueNodeData.delete(id)
      }
    }

    // Add/update existing nodes
    graph._nodes.forEach((node) => {
      const id = node.id

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
    const id = node.id

    // Store non-reactive reference to original node
    nodeRefs.set(id, node)

    // Extract initial data for Vue (may be incomplete during graph configure)
    vueNodeData.set(id, extractVueNodeData(node))

    const initializeVueNodeLayout = () => {
      // Check if the node was removed mid-sequence
      if (!nodeRefs.has(id)) return

      // Extract actual positions after configure() has potentially updated them
      const nodePosition = { x: node.pos[0], y: node.pos[1] }
      const nodeSize = { width: node.size[0], height: node.size[1] }

      // Skip layout creation if it already exists
      // (e.g. in-place node replacement where the old node's layout is reused for the new node with the same ID).
      const existingLayout = layoutStore.getNodeLayoutRef(id).value
      if (existingLayout) return

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

  const dropNodeReferences = (id: NodeId) => {
    nodeRefs.delete(id)
    vueNodeData.delete(id)
  }

  const handleNodeRemoved = (
    node: LGraphNode,
    originalCallback?: (node: LGraphNode) => void
  ) => {
    const id = node.id

    // Remove node from layout store
    setSource(LayoutSource.Canvas)
    void deleteNode(id)
    dropNodeReferences(id)
    originalCallback?.(node)
  }

  /**
   * Creates cleanup function for event listeners and state
   */
  const createCleanupFunction = (
    originalOnNodeAdded: ((node: LGraphNode) => void) | undefined,
    originalOnNodeRemoved: ((node: LGraphNode) => void) | undefined,
    originalOnTrigger: ((event: LGraphTriggerEvent) => void) | undefined,
    beforeNodeRemovedListener: (e: CustomEvent<{ node: LGraphNode }>) => void
  ) => {
    return () => {
      // Restore original callbacks
      graph.onNodeAdded = originalOnNodeAdded || undefined
      graph.onNodeRemoved = originalOnNodeRemoved || undefined
      graph.onTrigger = originalOnTrigger || undefined

      graph.events.removeEventListener(
        'node:before-removed',
        beforeNodeRemovedListener
      )

      // Clear all state maps
      nodeRefs.clear()
      vueNodeData.clear()
    }
  }

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
            case 'badges':
              vueNodeData.set(nodeId, {
                ...currentData,
                badges: propertyEvent.newValue as Badges
              })
              break
          }
        }
      },
      'node:slot-errors:changed': (slotErrorsEvent) => {
        refreshNodeSlots(toNodeId(slotErrorsEvent.nodeId))
      },
      'node:slot-links:changed': (slotLinksEvent) => {
        if (slotLinksEvent.slotType === NodeSlotType.INPUT) {
          refreshNodeSlots(toNodeId(slotLinksEvent.nodeId))
        }
      },
      'node:slot-label:changed': (slotLabelEvent) => {
        const nodeId = toNodeId(slotLabelEvent.nodeId)
        const nodeRef = nodeRefs.get(nodeId)
        if (!nodeRef) return

        // Force shallowReactive to detect the deep property change
        // by re-assigning the affected array through the defineProperty setter.
        if (slotLabelEvent.slotType !== NodeSlotType.OUTPUT && nodeRef.inputs) {
          nodeRef.inputs = [...nodeRef.inputs]
        }
        if (slotLabelEvent.slotType !== NodeSlotType.INPUT && nodeRef.outputs) {
          nodeRef.outputs = [...nodeRef.outputs]
        }
        // Re-extract widget data so the label reflects the rename
        vueNodeData.set(nodeId, extractVueNodeData(nodeRef))
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
        case 'node:slot-label:changed':
          triggerHandlers['node:slot-label:changed'](event)
          break
      }

      // Chain to original handler
      originalOnTrigger?.(event)
    }

    // Initialize state
    syncWithGraph()

    return createCleanupFunction(
      originalOnNodeAdded || undefined,
      originalOnNodeRemoved || undefined,
      originalOnTrigger || undefined,
      beforeNodeRemovedListener
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
