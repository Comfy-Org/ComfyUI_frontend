import type { NodeId } from '@comfyorg/graph-model/nodeId'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'

import type { DocumentHandles } from '@/platform/nodeApi/shared/documentHandles'
import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { isStoreKey } from '@/platform/nodeApi/v4/checkedFields'
import { checkedBoolean } from '@/platform/nodeApi/v4/edit/checkedArguments'
import type { SavedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type { WidgetHandle, WidgetOptions } from '@/platform/nodeApi/v4/types'
import { requiredSize } from './definitionFields'
import { savableValue } from '@/platform/nodeApi/shared/savableValue'
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
  const cache = handles.createCache<WidgetHandle, LiveWidget>()
  const handleFor: WidgetHandleFor = (graph, node, name) =>
    cache.handleFor(
      graph,
      keyOf(node.id, name),
      (current) => liveWidget(current, node.id, name),
      (locate) => widgetHandle(name, locate, { ...services, handleFor })
    )
  return handleFor
}

function liveWidget(
  graph: LGraph,
  nodeId: NodeId,
  name: string
): LiveWidget | undefined {
  const node = graph.getNodeById(nodeId)
  const widget = node && widgetNamed(node, name)
  return node && widget ? { graph, node, widget } : undefined
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

interface WidgetAccess {
  live(): LiveWidget | undefined
  read<T>(reader: (widget: BaseWidget) => T): T | undefined
  change(edit: (found: LiveWidget) => void): boolean
}

function widgetHandle(
  name: string,
  live: () => LiveWidget | undefined,
  services: WidgetServices
): WidgetHandle {
  const access = widgetAccess(live)
  return Object.freeze({
    name,
    get isDeleted() {
      return !access.live()
    },
    get widgetType() {
      return access.read((widget) => widget.type)
    },
    ...valueMembers(access, services),
    ...displayMembers(access, services.edits),
    ...linkMembers(access, services),
    on: (event: unknown, listener: unknown) =>
      services.events.listen(access.live()?.widget, event, listener)
  })
}

function widgetAccess(live: () => LiveWidget | undefined): WidgetAccess {
  return {
    live,
    read(reader) {
      const found = live()
      return found && reader(found.widget)
    },
    change(edit) {
      const found = live()
      if (found) edit(found)
      return !!found
    }
  }
}

function valueMembers(
  { read, change }: WidgetAccess,
  { edits, copyOfSaved }: WidgetServices
): Pick<WidgetHandle, 'getValue' | 'setValue' | 'getOptions' | 'setOption'> {
  return {
    getValue: () =>
      read((widget) => copyOfSaved('getValue', widget.value ?? null)),
    setValue(value: unknown) {
      const checked = savableValue('setValue', value)
      return change(({ node, widget }) => edits.setInput(node, widget, checked))
    },
    getOptions: () =>
      read(({ options }) =>
        copyOfSaved<Readonly<WidgetOptions>>('getOptions', { ...options })
      ),
    setOption(key: unknown, value: unknown) {
      const checkedKey = optionKey(key)
      const checked = savableValue('setOption', value, `options.${checkedKey}`)
      return change(({ node, widget }) =>
        edits.setOption(node, widget, checkedKey, checked)
      )
    }
  }
}

function displayMembers(
  { read, change }: WidgetAccess,
  edits: WidgetEdits
): Pick<
  WidgetHandle,
  | 'setLabel'
  | 'isHidden'
  | 'setHidden'
  | 'isDisabled'
  | 'setDisabled'
  | 'isSerialized'
  | 'setHeight'
> {
  return {
    setLabel(label: unknown) {
      if (typeof label !== 'string') {
        throw invalidArgument('setLabel', 'a label', label)
      }
      return change(({ node, widget }) => edits.setLabel(node, widget, label))
    },
    isHidden: () => read((widget) => widget.hidden),
    setHidden(hidden: unknown) {
      const checked = checkedBoolean('setHidden', 'hidden', hidden)
      return change(({ node, widget }) =>
        edits.setHidden(node, widget, checked)
      )
    },
    isDisabled: () => read((widget) => !!widget.disabled),
    setDisabled(disabled: unknown) {
      const checked = checkedBoolean('setDisabled', 'disabled', disabled)
      return change(({ node, widget }) =>
        edits.setDisabled(node, widget, checked)
      )
    },
    isSerialized: () => read((widget) => widget.serialize !== false),
    setHeight(height: unknown) {
      const checked = requiredSize('setHeight', 'height', height)
      return change(({ node, widget }) =>
        edits.setHeight(node, widget, checked)
      )
    }
  }
}

function linkMembers(
  { live, change }: WidgetAccess,
  { edits, handleFor }: WidgetServices
): Pick<WidgetHandle, 'linked' | 'setLinked'> {
  return {
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
      return change(({ node, widget }) => {
        const linked = checked.map((linkedName) =>
          linkedWidget(node, widget, linkedName)
        )
        edits.setLinked(node, widget, linked)
      })
    }
  }
}

function optionKey(key: unknown): string {
  if (!isStoreKey(key)) {
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
