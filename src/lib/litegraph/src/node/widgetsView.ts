import { shallowReactive } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { toConcreteWidget } from '@/lib/litegraph/src/widgets/widgetMap'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import type { RefusedWidget } from '@/types/widgetId'
import {
  dropUnrenamableDuplicateWidgets,
  isWidgetNameUnreadable,
  widgetId
} from '@/types/widgetId'

import { createArrayMutationView } from '../infrastructure/createMutationView'
import type { INodeInputSlot } from '../types/slots'
import { isNodeBindable } from '../utils/type'
import { getWidgetIds } from '../utils/widget'
import { BaseWidget } from '../widgets/BaseWidget'

export type WidgetRefusalReport =
  | { kind: 'refusal'; finding: RefusedWidget<IBaseWidget> }
  | { kind: 'teardown-failure'; error: unknown }

type WidgetRefusalReporter = (report: WidgetRefusalReport) => void
const ignoreWidgetRefusal: WidgetRefusalReporter = () => {}

interface WidgetsViewState {
  target: IBaseWidget[]
  view: IBaseWidget[]
  present: boolean
  commit: (widgets: IBaseWidget[]) => void
  reporter?: WidgetRefusalReporter
}

const reportedUnresolved = new WeakMap<LGraphNode, Set<IBaseWidget>>()
const restorationSlots = new WeakMap<
  LGraphNode,
  {
    slots: ReadonlyMap<IBaseWidget, number>
    count: number
    refusalChangedOrder: boolean
  }
>()

const states = new WeakMap<LGraphNode, WidgetsViewState>()
const widgetsViewGetters = new WeakSet<() => IBaseWidget[] | undefined>()

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
  name: string | undefined,
  report: WidgetRefusalReporter
): void {
  if (!widget) return

  try {
    clearRefusedSlotBindings(node, widget, name)
  } catch (error) {
    report({ kind: 'teardown-failure', error })
  }

  try {
    widget.onRemove?.()
  } catch (error) {
    report({ kind: 'teardown-failure', error })
  }

  try {
    if (widget instanceof BaseWidget) widget.releaseRegisteredState()
  } catch (error) {
    report({ kind: 'teardown-failure', error })
  }
}

function refuseAmbiguousWidgets(
  node: LGraphNode,
  widgets: IBaseWidget[],
  report = states.get(node)?.reporter ?? ignoreWidgetRefusal
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
        report({ kind: 'refusal', finding })
      }
      continue
    }
    removed.add(finding.widget)
    releaseRefusedWidget(node, finding.widget, finding.name, report)
    report({ kind: 'refusal', finding })
  }
  if (removed.size) {
    const captured = restorationSlots.get(node)
    if (captured) captured.refusalChangedOrder = true
  }
  return removed
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

export function captureWidgetRestorationSlots(node: LGraphNode): void {
  const slots = new Map<IBaseWidget, number>()
  let position = 0
  for (const widget of node.widgets ?? []) {
    if (widget.serialize === false) continue
    slots.set(widget, position++)
  }
  restorationSlots.set(node, {
    slots,
    count: position,
    refusalChangedOrder: false
  })
}

export function getWidgetRestorationSlot(
  node: LGraphNode,
  widget: IBaseWidget,
  fallback: number,
  savedSlotCount: number
): number {
  const captured = restorationSlots.get(node)
  if (!captured?.refusalChangedOrder || captured.count !== savedSlotCount)
    return fallback
  return captured.slots.get(widget) ?? fallback
}

export function clearWidgetRestorationSlots(node: LGraphNode): void {
  restorationSlots.delete(node)
}

export function refuseAmbiguousNodeWidgets(
  node: LGraphNode,
  report: WidgetRefusalReporter
): void {
  if (!commitsThroughWidgetsView(node)) return
  const state = states.get(node)
  if (!state) return
  state.reporter = report
  const target = state.target
  if (!target.length) return
  refuseAmbiguousWidgets(node, target, report)
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
