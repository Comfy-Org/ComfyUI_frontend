import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

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
import { nodeAccess } from './nodeAccess'
import type { LiveNode, NodeAccess } from './nodeAccess'
import {
  checkedMountDef,
  createMountedWidget,
  renderMounted
} from './mountedWidget'
import type { MountSpec } from './mountedWidget'
import { checkedWidgetDef } from './widgetDef'
import { createWidgetEdits } from './widgetEdits'
import { createWidgetEvents } from './widgetEvents'
import { orderMembers } from './widgetOrder'
import type { WidgetEdits } from './widgetEdits'
import { createWidgetHandles, widgetNamed } from './widgetHandle'
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

function widgetCollection(
  locate: () => LiveNodeOnGraph | undefined,
  services: CollectionServices
): WidgetCollection {
  const access = nodeAccess(locate)
  const reads = readMembers(access, services.handleFor)
  return Object.freeze({
    get length() {
      return access.read(({ widgets }) => widgets.length)
    },
    ...reads,
    *[Symbol.iterator]() {
      yield* reads.all() ?? []
    },
    ...additionMembers(access, services),
    ...orderMembers(access, services.edits)
  })
}

function readMembers(
  access: NodeAccess,
  handleFor: WidgetHandleFor
): Pick<WidgetCollection, 'get' | 'at' | 'all' | 'names'> {
  function handles({ graph, node, widgets }: LiveNode): WidgetHandle[] {
    return widgets.map((widget) => handleFor(graph, node, widget.name))
  }
  return {
    get(name: unknown) {
      if (typeof name !== 'string') {
        throw invalidArgument('get', 'a widget name', name)
      }
      return access.read(({ graph, node }) =>
        widgetNamed(node, name) ? handleFor(graph, node, name) : undefined
      )
    },
    at(index: unknown) {
      if (typeof index !== 'number' || !Number.isInteger(index)) {
        throw invalidArgument('at', 'a whole number', index)
      }
      return access.read((found) => handles(found).at(index))
    },
    all: () => access.read((found) => Object.freeze(handles(found))),
    names: () =>
      access.read(({ widgets }) =>
        Object.freeze(widgets.map(({ name }) => name))
      )
  }
}

function additionMembers(
  access: NodeAccess,
  services: CollectionServices
): Pick<WidgetCollection, 'add' | 'mount' | 'canvas'> {
  return {
    add(def: unknown) {
      const checked = checkedWidgetDef(def)
      return access.read(({ graph, node }) => {
        refuseTakenName('add', node, checked.name)
        services.edits.addWidget(node, checked)
        return services.handleFor(graph, node, checked.name)
      })
    },
    mount(def: unknown) {
      const spec = checkedMountDef('mount', def)
      return access.read((found) => mountOn(found, spec, services))
    },
    canvas(def: unknown) {
      const { spec, redraw } = checkedCanvasDef(def)
      return access.read((found) => {
        const widget = mountOn(found, spec, services)
        return widget && Object.freeze({ widget, redraw })
      })
    }
  }
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
