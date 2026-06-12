import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'
import { parseWidgetId, widgetId } from '@/types/widgetId'
import { forEachNode } from '@/utils/graphTraversalUtil'

import {
  computeNextControlledValue,
  isValueControlMode
} from './control/valueControl'

export type WidgetControlPhase = 'before' | 'after'

/**
 * Widget ids whose input slot is currently link-fed, so their value comes from
 * upstream and control must not advance it. Derived live from the graph.
 */
function collectLinkFedTargets(graph: LGraph): Set<WidgetId> {
  const graphId = graph.rootGraph.id
  const linkFed = new Set<WidgetId>()
  forEachNode(graph, (node) => {
    for (const input of node.inputs ?? []) {
      if (input.link == null) continue
      if (input.widgetId) {
        linkFed.add(input.widgetId)
      } else if (input.widget?.name) {
        linkFed.add(widgetId(graphId, node.id, input.widget.name))
      }
    }
  })
  return linkFed
}

/** Advances the graph's controlled widget store values at the given queue phase. */
export function runWidgetControl(
  graph: LGraph,
  phase: WidgetControlPhase,
  { isPartialExecution }: { isPartialExecution?: boolean } = {}
): void {
  if (isPartialExecution) return

  const runBefore =
    useSettingStore().get('Comfy.WidgetControlMode') === 'before'
  if (phase === 'before' && !runBefore) return
  if (phase === 'after' && runBefore) return

  const store = useWidgetValueStore()
  const linkFed = collectLinkFedTargets(graph)
  for (const [targetId, control] of store.getWidgetControls(
    graph.rootGraph.id
  )) {
    const target = store.getWidget(targetId)
    if (!target || linkFed.has(targetId)) continue

    if (phase === 'before' && !control.hasExecuted) {
      control.hasExecuted = true
      continue
    }
    control.hasExecuted = true

    const mode = store.getWidget(control.controlWidgetId)?.value
    if (!isValueControlMode(mode)) continue

    const filter = control.filterWidgetId
      ? store.getWidget(control.filterWidgetId)?.value
      : undefined

    const next = computeNextControlledValue(target, mode, {
      comboFilter: typeof filter === 'string' ? filter : undefined,
      nodeId: parseWidgetId(targetId).nodeId
    })
    if (next === undefined) continue

    store.setValue(targetId, next)
  }
}
