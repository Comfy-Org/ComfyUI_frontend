import { shallowReactive } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { createArrayMutationView } from '../infrastructure/createMutationView'
import { getWidgetIds } from '../utils/widget'

interface WidgetsViewState {
  target: IBaseWidget[]
  view: IBaseWidget[]
  present: boolean
  commit: (widgets: readonly IBaseWidget[]) => void
}

const states = new WeakMap<LGraphNode, WidgetsViewState>()

function syncWidgetOrder(
  node: LGraphNode,
  widgets: readonly IBaseWidget[]
): void {
  node._widgetSlotsDirty = true
  const graphId = node.graph?.rootGraph.id
  if (!graphId) return

  useWidgetValueStore().replaceNodeWidgetOrder(
    graphId,
    node.id,
    getWidgetIds(widgets)
  )
}

function defineWidgetsView(node: LGraphNode, state: WidgetsViewState): void {
  Object.defineProperty(node, 'widgets', {
    get: () => (state.present ? state.view : undefined),
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
  const commit = (widgets: readonly IBaseWidget[]) =>
    syncWidgetOrder(node, widgets)
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
  if (!state || !descriptor || !('value' in descriptor)) return

  const widgets = node.widgets
  defineWidgetsView(node, state)
  node.widgets = widgets
}
