import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { snapPoint } from '@/lib/litegraph/src/measure'
import { captureWidgetRestorationSlots } from '@/lib/litegraph/src/node/widgetsView'
import type { ISerialisedNode } from '@comfyorg/graph-model/serialisation'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { useExtensionService } from '@/platform/extensions/services/extensionService'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

export function createMissingNode(
  type: string,
  title = '',
  serialization?: ISerialisedNode
) {
  const node = new LGraphNode(title, type)
  node.has_errors = true
  node.last_serialization = serialization
  return node
}

export function loadSerialisedNode(
  graph: LGraph,
  info: ISerialisedNode | { configuredNode: LGraphNode },
  {
    resetInvalidValues = false,
    snapTo = LiteGraph.alwaysSnapToGrid ? graph.getSnapToGridSize() : 0,
    configure = (node: LGraphNode, info: ISerialisedNode) =>
      node.configure(info)
  } = {}
): LGraphNode {
  const node =
    'configuredNode' in info
      ? info.configuredNode
      : (LiteGraph.createNode(info.type, info.title) ??
        createMissingNode(info.type, '', info))

  if (!('configuredNode' in info)) {
    node.id = toNodeId(info.id)
    captureWidgetRestorationSlots(node)
    graph.add(node, true)
    configure(node, info)
    if (LiteGraph.alwaysSnapToGrid) node.snapToGrid(snapTo)
  }

  const size = node.computeSize()
  size[0] = Math.max(node.size[0], size[0])
  size[1] = Math.max(node.size[1], size[1])
  snapPoint(size, snapTo, 'ceil')
  node.setSize(size)

  for (const widget of node.widgets ?? []) {
    migrateLegacyWidgetValue(node, widget)
    resetInvalidComboValue(widget, resetInvalidValues)
  }

  useExtensionService().invokeExtensions('loadedGraphNode', node)
  return node
}

function migrateLegacyWidgetValue(node: LGraphNode, widget: IBaseWidget) {
  const isSampler = ['KSampler', 'KSamplerAdvanced'].includes(node.type)
  if (
    isSampler &&
    widget.name === 'sampler_name' &&
    typeof widget.value === 'string' &&
    widget.value.startsWith('sample_')
  ) {
    widget.value = widget.value.slice(7)
  }
  if (
    ['KSampler', 'KSamplerAdvanced', 'PrimitiveNode'].includes(node.type) &&
    widget.name === 'control_after_generate'
  ) {
    if (widget.value === true) widget.value = 'randomize'
    else if (widget.value === false) widget.value = 'fixed'
  }
}

function resetInvalidComboValue(
  widget: IBaseWidget,
  resetInvalidValues: boolean
) {
  if (widget.type !== 'combo') return
  const values = widget.options.values
  if (!Array.isArray(values) || values.length === 0) return
  const availableValues: readonly unknown[] = values
  if (
    widget.value == null ||
    (resetInvalidValues && !availableValues.includes(widget.value))
  ) {
    widget.value = values[0]
  }
}
