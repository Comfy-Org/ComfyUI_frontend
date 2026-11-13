import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'

import type { DocumentHandles } from '@/platform/nodeApi/shared/documentHandles'
import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { savedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type { SavedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type { EditRunner } from '@/platform/nodeApi/v4/edit/editRunner'
import type { LiveNode as LiveNodeOnGraph } from '@/platform/nodeApi/v4/nodeHandle'
import type { WidgetsOf } from './widgetsOf'
import type {
  WidgetCollection,
  WidgetHandle
} from '@/platform/nodeApi/v4/types'
import { checkedCanvasDef } from './canvasWidget'
import {
  checkedMountDef,
  createMountedWidget,
  renderMounted
} from './mountedWidget'
import type { MountSpec } from './mountedWidget'
import { checkedWidgetDef } from './widgetDef'
import { createWidgetEdits } from './widgetEdits'
import { createWidgetEvents } from './widgetEvents'
import type { WidgetEdits } from './widgetEdits'
import { createWidgetHandles, nameList, widgetNamed } from './widgetHandle'
import type { WidgetHandleFor } from './widgetHandle'

export function createWidgetCollections(
  handles: DocumentHandles,
  runner: EditRunner
): WidgetsOf {
  const copyOfSaved = savedCopier()
  const events = createWidgetEvents(copyOfSaved)
  const edits = createWidgetEdits(runner, events.asSetValue)
  const handleFor = createWidgetHandles(handles, { edits, events, copyOfSaved })
  return (locate) => widgetCollection(locate, { handleFor, edits, copyOfSaved })
}

interface CollectionServices {
  readonly handleFor: WidgetHandleFor
  readonly edits: WidgetEdits
  readonly copyOfSaved: SavedCopier
}

interface LiveNode {
  readonly graph: LGraph
  readonly node: LGraphNode
  readonly widgets: readonly BaseWidget[]
}

function widgetCollection(
  locate: () => LiveNodeOnGraph | undefined,
  services: CollectionServices
): WidgetCollection {
  const { handleFor, edits } = services
  function live(): LiveNode | undefined {
    const found = locate()
    if (!found) return undefined
    const { graph, node } = found
    const widgets = (node.widgets ?? []).filter(
      (widget): widget is BaseWidget => widget instanceof BaseWidget
    )
    return { graph, node, widgets }
  }
  function read<T>(reader: (found: LiveNode) => T): T | undefined {
    const found = live()
    return found && reader(found)
  }
  function handles({ graph, node, widgets }: LiveNode): WidgetHandle[] {
    return widgets.map((widget) => handleFor(graph, node, widget.name))
  }
  function all(): readonly WidgetHandle[] | undefined {
    return read((found) => Object.freeze(handles(found)))
  }

  return Object.freeze({
    get length() {
      return read(({ widgets }) => widgets.length)
    },
    get(name: unknown) {
      if (typeof name !== 'string') {
        throw invalidArgument('get', 'a widget name', name)
      }
      return read(({ graph, node }) =>
        widgetNamed(node, name) ? handleFor(graph, node, name) : undefined
      )
    },
    at(index: unknown) {
      if (typeof index !== 'number' || !Number.isInteger(index)) {
        throw invalidArgument('at', 'a whole number', index)
      }
      return read((found) => handles(found).at(index))
    },
    all,
    names: () =>
      read(({ widgets }) => Object.freeze(widgets.map(({ name }) => name))),
    *[Symbol.iterator]() {
      yield* all() ?? []
    },

    add(def: unknown) {
      const checked = checkedWidgetDef(def)
      return read(({ graph, node }) => {
        refuseTakenName('add', node, checked.name)
        edits.addWidget(node, checked)
        return handleFor(graph, node, checked.name)
      })
    },
    mount(def: unknown) {
      const spec = checkedMountDef('mount', def)
      return read((found) => mountOn(found, spec, services))
    },
    canvas(def: unknown) {
      const { spec, redraw } = checkedCanvasDef(def)
      return read((found) => {
        const widget = mountOn(found, spec, services)
        return widget && Object.freeze({ widget, redraw })
      })
    },
    remove(name: unknown) {
      if (typeof name !== 'string') {
        throw invalidArgument('remove', 'a widget name', name)
      }
      const found = live()
      const widget = found && widgetNamed(found.node, name)
      if (!found || !widget) return false
      edits.removeWidget(found.node, widget)
      return true
    },
    reorder(names: unknown) {
      const checked = nameList('reorder', names)
      const found = live()
      if (found) edits.reorderWidgets(found.node, ordered(found, checked))
    },
    move(name: unknown, index: unknown) {
      if (typeof name !== 'string') {
        throw invalidArgument('move', 'a widget name', name)
      }
      if (typeof index !== 'number' || !Number.isInteger(index)) {
        throw invalidArgument('move', 'a whole number', index)
      }
      const found = live()
      if (found) edits.reorderWidgets(found.node, moved(found, name, index))
    }
  })
}

function ordered(found: LiveNode, names: readonly string[]): IBaseWidget[] {
  const named = names.flatMap((name) =>
    found.widgets.filter((widget) => widget.name === name)
  )
  const isPermutation =
    named.length === found.widgets.length &&
    names.length === found.widgets.length &&
    new Set(named).size === named.length
  if (!isPermutation) {
    throw invalidArgument('reorder', 'the name of every widget once', names)
  }
  return [...named, ...unaddressable(found)]
}

function moved(found: LiveNode, name: string, index: number): IBaseWidget[] {
  const widget = found.widgets.find((candidate) => candidate.name === name)
  if (!widget) {
    throw invalidArgument('move', 'the name of a widget on this node', name)
  }
  const others = found.widgets.filter((candidate) => candidate !== widget)
  const to = Math.min(Math.max(index, 0), others.length)
  return [
    ...others.slice(0, to),
    widget,
    ...others.slice(to),
    ...unaddressable(found)
  ]
}

function unaddressable({ node, widgets }: LiveNode): IBaseWidget[] {
  const addressable = new Set<IBaseWidget>(widgets)
  return (node.widgets ?? []).filter((widget) => !addressable.has(widget))
}

function refuseTakenName(member: string, node: LGraphNode, name: string): void {
  if (node.widgets?.some((widget) => widget.name === name)) {
    throw invalidArgument(member, 'a name no widget of the node has', name)
  }
}

function mountOn(
  { graph, node }: LiveNode,
  spec: MountSpec,
  { handleFor, edits, copyOfSaved }: CollectionServices
): WidgetHandle | undefined {
  refuseTakenName(spec.member, node, spec.name)
  const mounted = createMountedWidget(node, spec)
  edits.addDomWidget(node, mounted.widget, spec.height)
  const handle = handleFor(graph, node, spec.name)
  renderMounted(spec, mounted, handle, copyOfSaved)
  return handle
}
