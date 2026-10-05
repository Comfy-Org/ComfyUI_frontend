import { shallowReactive } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { toConcreteWidget } from '@/lib/litegraph/src/widgets/widgetMap'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { reportError } from '@/platform/telemetry/reportError'
import type { RefusedWidget } from '@/types/widgetId'
import {
  dropUnrenamableDuplicateWidgets,
  isWidgetNameUnreadable,
  widgetId
} from '@/types/widgetId'

import { createArrayMutationView } from '../infrastructure/createMutationView'
import type { INodeInputSlot } from '../interfaces'
import { isNodeBindable } from '../utils/type'
import { getWidgetIds } from '../utils/widget'
import { BaseWidget } from '../widgets/BaseWidget'

const REFUSAL_TEARDOWN_ERROR_TYPE = 'failure_tearing_down_refused_widget'

interface WidgetsViewState {
  target: IBaseWidget[]
  view: IBaseWidget[]
  present: boolean
  commit: (widgets: IBaseWidget[]) => void
}

const reportedUnresolved = new WeakMap<LGraphNode, Set<IBaseWidget>>()

const states = new WeakMap<LGraphNode, WidgetsViewState>()
const widgetsViewGetters = new WeakSet<() => IBaseWidget[] | undefined>()

function safeRead(read: () => unknown): string | undefined {
  try {
    const value = read()
    return value === undefined ? undefined : String(value)
  } catch {
    return undefined
  }
}

function reportTeardownFailure(node: LGraphNode, error: unknown): void {
  reportError(error, {
    errorType: REFUSAL_TEARDOWN_ERROR_TYPE,
    surface: 'graph',
    level: 'warning',
    tags: { node_type: node.type },
    context: { nodeId: String(node.id) }
  })
}

function inputBindsWidget(
  input: INodeInputSlot,
  widget: IBaseWidget,
  name: string | undefined
): boolean {
  if (input._widget === widget) return true
  return name !== undefined && input.widget?.name === name
}

function clearRefusedSlotBindings(
  node: LGraphNode,
  widget: IBaseWidget,
  name: string | undefined
): void {
  for (const input of node.inputs) {
    if (!inputBindsWidget(input, widget, name)) continue
    input._widget = undefined
    input.widget = undefined
    input.pos = undefined
  }
}

function releaseRefusedWidget(
  node: LGraphNode,
  widget: IBaseWidget | undefined,
  name: string | undefined
): void {
  if (!widget) return

  try {
    clearRefusedSlotBindings(node, widget, name)
  } catch (error) {
    reportTeardownFailure(node, error)
  }

  try {
    widget.onRemove?.()
  } catch (error) {
    reportTeardownFailure(node, error)
  }

  try {
    if (widget instanceof BaseWidget) widget.releaseRegisteredState()
  } catch (error) {
    reportTeardownFailure(node, error)
  }
}

function refuseAmbiguousWidgets(
  node: LGraphNode,
  widgets: IBaseWidget[]
): ReadonlySet<IBaseWidget> {
  const graphId = node.graph?.rootGraph.id
  const store = useWidgetValueStore()
  const refused = dropUnrenamableDuplicateWidgets(
    widgets,
    (name) =>
      graphId !== undefined &&
      store.getWidget(widgetId(graphId, node.id, name)) !== undefined
  )

  const previouslyUnresolved = reportedUnresolved.get(node)
  const unresolved = new Set(
    refused
      .filter(({ cause }) => cause === 'unresolved-duplicate')
      .map(({ widget }) => widget)
  )
  if (unresolved.size) reportedUnresolved.set(node, unresolved)
  else reportedUnresolved.delete(node)

  const removed = new Set<IBaseWidget>()
  for (const finding of refused) {
    if (finding.cause === 'unresolved-duplicate') {
      if (!previouslyUnresolved?.has(finding.widget)) {
        reportRefusal(node, finding)
      }
      continue
    }
    removed.add(finding.widget)
    releaseRefusedWidget(node, finding.widget, finding.name)
    reportRefusal(node, finding)
  }
  return removed
}

const REFUSAL_ALERTS: Record<
  RefusedWidget<IBaseWidget>['cause'],
  {
    errorType: string
    message: (nodeId: LGraphNode['id'], name: string | undefined) => string
  }
> = {
  'unreadable-name': {
    errorType: 'failure_reading_widget_name',
    message: (nodeId) =>
      `Refused a widget on node ${nodeId}: no widget identity can be derived from its name`
  },
  'unresolved-duplicate': {
    errorType: 'failure_resolving_widget_duplicate_name',
    message: (nodeId, name) =>
      `Kept a widget named "${name}" that node ${nodeId} already has under that name: the rename was declined rather than impossible, so the widget is left in place and the pair is unresolved for now`
  },
  'duplicate-name': {
    errorType: 'failure_renaming_widget_duplicate_name',
    message: (nodeId, name) =>
      `Refused a widget named "${name}": node ${nodeId} already has a widget of that name and the duplicate cannot be renamed`
  }
}

function reportRefusal(
  node: LGraphNode,
  { widget, cause, name }: RefusedWidget<IBaseWidget>
): void {
  const alert = REFUSAL_ALERTS[cause]
  reportError(new Error(alert.message(node.id, name)), {
    errorType: alert.errorType,
    surface: 'graph',
    level: 'warning',
    tags: { node_type: node.type },
    context: {
      nodeId: String(node.id),
      widgetName: name,
      widgetType: safeRead(() => widget.type)
    }
  })
}

function commitsThroughWidgetsView(node: LGraphNode): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(node, 'widgets')
  return !!descriptor?.get && widgetsViewGetters.has(descriptor.get)
}

export function wasWidgetRefused(
  node: LGraphNode,
  widget: IBaseWidget
): boolean {
  return commitsThroughWidgetsView(node) && !node.widgets?.includes(widget)
}

export function refuseAmbiguousNodeWidgets(node: LGraphNode): void {
  if (!commitsThroughWidgetsView(node)) return
  const target = states.get(node)?.target
  if (!target?.length) return
  refuseAmbiguousWidgets(node, target)
}

function syncWidgetOrder(node: LGraphNode, widgets: IBaseWidget[]): void {
  node._widgetSlotsDirty = true
  const graphId = node.graph?.rootGraph.id

  const concreteWidgets = widgets.map((widget) => {
    const unreadable = isWidgetNameUnreadable(widget)
    try {
      return toConcreteWidget(widget, node)
    } catch (error) {
      if (!unreadable) throw error
      return widget
    }
  })
  for (const [index, widget] of concreteWidgets.entries()) {
    widgets[index] = widget
  }

  if (!graphId) return

  const refused = refuseAmbiguousWidgets(node, widgets)

  for (const widget of concreteWidgets) {
    if (!refused.has(widget) && isNodeBindable(widget)) {
      widget.setNodeId(node.id)
    }
  }

  useWidgetValueStore().replaceNodeWidgetOrder(
    graphId,
    node.id,
    getWidgetIds(widgets)
  )
}

function defineWidgetsView(node: LGraphNode, state: WidgetsViewState): void {
  const getWidgets = () => (state.present ? state.view : undefined)
  widgetsViewGetters.add(getWidgets)
  Object.defineProperty(node, 'widgets', {
    get: getWidgets,
    set: (value: IBaseWidget[] | undefined) => {
      if (value === undefined) {
        if (!state.present) return
        state.present = false
        state.target.splice(0)
        state.commit(state.target)
        return
      }

      state.present = true
      state.view.splice(0, state.view.length, ...value)
    },
    configurable: true,
    enumerable: true
  })
}

export function initializeWidgetsView(node: LGraphNode): void {
  const target = shallowReactive<IBaseWidget[]>([])
  const commit = (widgets: IBaseWidget[]) => syncWidgetOrder(node, widgets)
  const state: WidgetsViewState = {
    target,
    view: createArrayMutationView(target, () => commit(target)),
    present: false,
    commit
  }
  states.set(node, state)
  defineWidgetsView(node, state)
}

export function normalizeWidgetsView(node: LGraphNode): void {
  const descriptor = Object.getOwnPropertyDescriptor(node, 'widgets')
  const state = states.get(node)
  if (!state || !descriptor) return

  if (!('value' in descriptor)) {
    if (!descriptor.get || !widgetsViewGetters.has(descriptor.get)) return
    state.commit(state.target)
    return
  }

  const widgets = node.widgets
  defineWidgetsView(node, state)
  node.widgets = widgets
}
