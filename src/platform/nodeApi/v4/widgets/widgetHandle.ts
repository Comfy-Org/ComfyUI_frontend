import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'

import type {
  DocumentHandles,
  GraphResolver
} from '@/platform/nodeApi/shared/documentHandles'
import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { SavedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type { WidgetHandle, WidgetOptions } from '@/platform/nodeApi/v4/types'
import { requiredFlag, requiredSize } from './definitionFields'
import { savableValue } from './savableValue'
import type { WidgetEdits } from './widgetEdits'
import type { WidgetEvents } from './widgetEvents'

/** The handle for a widget of a node in `graph`. */
export type WidgetHandleFor = (
  graph: LGraph,
  node: LGraphNode,
  name: string
) => WidgetHandle

/** The widget of `node` that a handle by this name reaches. */
export function widgetNamed(
  node: LGraphNode,
  name: string
): BaseWidget | undefined {
  return node.widgets?.find(
    (widget): widget is BaseWidget =>
      widget instanceof BaseWidget && widget.name === name
  )
}

export function createWidgetHandles(
  handles: DocumentHandles,
  services: Omit<WidgetServices, 'handleFor'>
): WidgetHandleFor {
  const cache = handles.createCache<WidgetHandle>((graph, key) => {
    const { nodeId, name } = parseKey(key)
    const node = graph.getNodeById(toNodeId(nodeId))
    return !!node && !!widgetNamed(node, name)
  })

  const handleFor: WidgetHandleFor = (graph, node, name) =>
    cache.handleFor(graph, keyOf(node.id, name), (resolveGraph) =>
      widgetHandle(
        { nodeId: node.id, name, resolveGraph },
        { ...services, handleFor }
      )
    )
  return handleFor
}

interface WidgetIdentity {
  readonly nodeId: NodeId
  readonly name: string
  readonly resolveGraph: GraphResolver
}

interface WidgetServices {
  readonly edits: WidgetEdits
  readonly events: WidgetEvents
  readonly copyOfSaved: SavedCopier
  readonly handleFor: WidgetHandleFor
}

interface LiveWidget {
  readonly graph: LGraph
  readonly node: LGraphNode
  readonly widget: BaseWidget
}

function widgetHandle(
  { nodeId, name, resolveGraph }: WidgetIdentity,
  { edits, events, copyOfSaved, handleFor }: WidgetServices
): WidgetHandle {
  function live(): LiveWidget | undefined {
    const graph = resolveGraph()
    const node = graph?.getNodeById(nodeId)
    const widget = node && widgetNamed(node, name)
    return graph && node && widget ? { graph, node, widget } : undefined
  }
  function read<T>(reader: (widget: BaseWidget) => T): T | undefined {
    const found = live()
    return found && reader(found.widget)
  }
  function change(edit: (found: LiveWidget) => void): void {
    const found = live()
    if (found) edit(found)
  }

  return Object.freeze({
    name,
    get isDeleted() {
      return !live()
    },
    get widgetType() {
      return read((widget) => widget.type)
    },

    getValue: () =>
      read((widget) => copyOfSaved('getValue', widget.value ?? null)),
    setValue(value: unknown) {
      const checked = savableValue('setValue', value)
      change(({ node, widget }) => edits.setInput(node, widget, checked))
    },
    getOptions: () =>
      read(({ options }) =>
        copyOfSaved<Readonly<WidgetOptions>>('getOptions', { ...options })
      ),
    setOption(key: unknown, value: unknown) {
      const checkedKey = optionKey(key)
      const checked = savableValue('setOption', value)
      change(({ node, widget }) =>
        edits.setOption(node, widget, checkedKey, checked)
      )
    },
    setLabel(label: unknown) {
      if (typeof label !== 'string') {
        throw invalidArgument('setLabel', 'a label', label)
      }
      change(({ node, widget }) => edits.setLabel(node, widget, label))
    },
    isHidden: () => read((widget) => widget.hidden),
    setHidden(hidden: unknown) {
      const checked = requiredFlag('setHidden', hidden)
      change(({ node, widget }) => edits.setHidden(node, widget, checked))
    },
    isDisabled: () => read((widget) => !!widget.disabled),
    setDisabled(disabled: unknown) {
      const checked = requiredFlag('setDisabled', disabled)
      change(({ node, widget }) => edits.setDisabled(node, widget, checked))
    },
    isSerialized: () => read((widget) => widget.serialize !== false),
    setHeight(height: unknown) {
      const checked = requiredSize('setHeight', height)
      change(({ node, widget }) => edits.setHeight(node, widget, checked))
    },

    linked() {
      const found = live()
      if (!found) return undefined
      const { graph, node, widget } = found
      const onNode = (widget.linkedWidgets ?? []).filter((linked) =>
        node.widgets?.includes(linked)
      )
      return Object.freeze(
        onNode.map((linked) => handleFor(graph, node, linked.name))
      )
    },
    setLinked(names: unknown) {
      const checked = nameList('setLinked', names)
      change(({ node, widget }) => {
        const linked = checked.map((linkedName) =>
          linkedWidget(node, widget, linkedName)
        )
        edits.setLinked(node, widget, linked)
      })
    },
    on: (event: unknown, listener: unknown) =>
      events.listen(live()?.widget, event, listener)
  })
}

const REFUSED_OPTION_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function optionKey(key: unknown): string {
  if (typeof key !== 'string' || !key || REFUSED_OPTION_KEYS.has(key)) {
    throw invalidArgument('setOption', 'an option name', key)
  }
  return key
}

/** Refuses anything but an array of strings, naming `member`. */
export function nameList(member: string, names: unknown): readonly string[] {
  if (
    !Array.isArray(names) ||
    !names.every((name): name is string => typeof name === 'string')
  ) {
    throw invalidArgument(member, 'an array of widget names', names)
  }
  return Array.from(names)
}

function linkedWidget(
  node: LGraphNode,
  widget: BaseWidget,
  name: string
): BaseWidget {
  const linked = widgetNamed(node, name)
  if (!linked || linked === widget) {
    throw invalidArgument(
      'setLinked',
      'the name of another widget on this node',
      name
    )
  }
  return linked
}

function keyOf(nodeId: NodeId, name: string): string {
  const id = String(nodeId)
  return `${id.length}:${id}${name}`
}

function parseKey(key: string): { nodeId: string; name: string } {
  const idStart = key.indexOf(':') + 1
  const idEnd = idStart + Number(key.slice(0, idStart - 1))
  return { nodeId: key.slice(idStart, idEnd), name: key.slice(idEnd) }
}
