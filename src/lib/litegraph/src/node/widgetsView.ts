import { shallowReactive } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { toConcreteWidget } from '@/lib/litegraph/src/widgets/widgetMap'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { reportError } from '@/platform/telemetry/reportError'
import { dropUnrenamableDuplicateWidgets } from '@/types/widgetId'

import { createArrayMutationView } from '../infrastructure/createMutationView'
import { getWidgetIds } from '../utils/widget'

/**
 * Stable `errorType` for the one state that breaks widget identity: a node
 * holding two widgets under one name that could not be renamed apart, so the
 * second is refused. See {@link dropUnrenamableDuplicateWidgets}.
 */
export const DUPLICATE_WIDGET_NAME_ERROR_TYPE = 'widget_duplicate_name_refused'

interface WidgetsViewState {
  target: IBaseWidget[]
  view: IBaseWidget[]
  present: boolean
  commit: (widgets: IBaseWidget[]) => void
}

const states = new WeakMap<LGraphNode, WidgetsViewState>()
const widgetsViewGetters = new WeakSet<() => IBaseWidget[] | undefined>()

/**
 * Enforces the unique-name invariant at the one place every widget reaches the
 * node: `node.widgets` is a mutation view, so `addWidget`, a raw
 * `widgets.push`, a splice and a whole-array assignment all commit through
 * here. A widget refused here is never registered with the store and never
 * rendered, because it is off the node before either happens.
 */
function refuseAmbiguousWidgets(
  node: LGraphNode,
  widgets: IBaseWidget[]
): void {
  const refused = dropUnrenamableDuplicateWidgets(widgets)
  if (!refused.length) return

  for (const widget of refused) {
    reportError(
      new Error(
        `Refused a widget named "${widget.name}": node ${node.id} already has a widget of that name and the duplicate cannot be renamed`
      ),
      {
        errorType: DUPLICATE_WIDGET_NAME_ERROR_TYPE,
        surface: 'graph',
        level: 'warning',
        tags: { node_type: node.type },
        context: {
          nodeId: String(node.id),
          widgetName: widget.name,
          widgetType: widget.type
        }
      }
    )
  }
}

function syncWidgetOrder(node: LGraphNode, widgets: IBaseWidget[]): void {
  node._widgetSlotsDirty = true
  const graphId = node.graph?.rootGraph.id

  refuseAmbiguousWidgets(node, widgets)

  for (const [index, widget] of widgets.entries()) {
    const concreteWidget = toConcreteWidget(widget, node)
    widgets[index] = concreteWidget
    if (graphId) concreteWidget.setNodeId(node.id)
  }

  if (!graphId) return
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
