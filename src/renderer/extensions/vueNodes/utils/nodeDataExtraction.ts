import { reactiveComputed } from '@vueuse/core'
import cloneDeep from 'es-toolkit/compat/cloneDeep'
import { shallowReactive } from 'vue'

import { promotedInputWidgets } from '@/core/graph/subgraph/promotedInputWidget'
import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import type {
  LGraph,
  LGraphNode,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { app } from '@/scripts/app'
import { isDOMWidget } from '@/scripts/domWidget'
import { IS_CONTROL_WIDGET } from '@/scripts/widgets'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import type {
  NodeDataState,
  SafeWidgetData,
  WidgetSlotMetadata
} from '@/types/nodeData'
import type { SafeControlWidget, WidgetValue } from '@/types/simplifiedWidget'
import { normalizeControlOption } from '@/types/simplifiedWidget'
import type { WidgetId } from '@/types/widgetId'
import { getWidgetIdForNode } from '@/utils/litegraphUtil'
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
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((item): item is File => item instanceof File)
    ) {
      return value
    }
    return value
  }
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
  const nodeDefStore = useNodeDefStore()

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
        controlWidget: getControlWidget(widget),
        spec: nodeDefStore.getInputSpecForWidget(node, widget.name),
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

export function buildSlotMetadata(
  inputs: INodeInputSlot[] | undefined,
  graphRef: LGraph | null | undefined
): Map<string, WidgetSlotMetadata> {
  const metadata = new Map<string, WidgetSlotMetadata>()
  inputs?.forEach((input, index) => {
    const link =
      input.link != null && graphRef ? graphRef.getLink(input.link) : null
    const originNode =
      link && graphRef ? graphRef.getNodeById(link.origin_id) : null

    const slotInfo: WidgetSlotMetadata = {
      index,
      linked: input.link != null,
      originNodeId: link && originNode ? link.origin_id : undefined,
      originOutputName:
        link && originNode
          ? originNode.outputs?.[link.origin_slot]?.name
          : undefined,
      type: String(input.type)
    }
    if (input.name) metadata.set(input.name, slotInfo)
    if (input.widget?.name) metadata.set(input.widget.name, slotInfo)
  })
  return metadata
}

const nodesWithReactiveArrays = new WeakSet<LGraphNode>()

export function installReactiveNodeArrays(node: LGraphNode): void {
  if (nodesWithReactiveArrays.has(node)) return
  nodesWithReactiveArrays.add(node)

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
}

export function extractVueNodeData(node: LGraphNode): NodeDataState {
  const subgraphId =
    node.graph && 'id' in node.graph && node.graph !== node.graph.rootGraph
      ? String(node.graph.id)
      : null
  const slotMetadata = new Map<string, WidgetSlotMetadata>()

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
    inputs: node.inputs,
    outputs: node.outputs,
    flags: node.flags ? { ...node.flags } : undefined,
    color: node.color || undefined,
    bgcolor: node.bgcolor || undefined,
    resizable: node.resizable,
    shape: node.shape,
    showAdvanced: node.showAdvanced
  }
}
