import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'
import { parseWidgetId, widgetId } from '@/types/widgetId'
import { forEachNode } from '@/utils/graphTraversalUtil'
import { mapLiveWidgetsById } from '@/utils/litegraphUtil'

import { computeNextControlledValue } from './valueControl'

type WidgetControlPhase = 'before' | 'after'

function collectGraphTargets(graph: LGraph): {
  linkFed: Set<WidgetId>
  live: Map<WidgetId, IBaseWidget>
} {
  const graphId = graph.rootGraph.id
  const linkFed = new Set<WidgetId>()
  const live = new Map<WidgetId, IBaseWidget>()

  forEachNode(graph, (node) => {
    for (const [id, widget] of mapLiveWidgetsById(node)) live.set(id, widget)
    for (const [index, input] of (node.inputs ?? []).entries()) {
      if (input.widgetId) {
        const widget = node.getWidgetFromSlot(input)
        if (widget) live.set(input.widgetId, widget)
      }
      if (!node.isInputConnected(index)) continue
      if (input.widgetId) linkFed.add(input.widgetId)
      else if (input.widget?.name) {
        linkFed.add(widgetId(graphId, node.id, input.widget.name))
      }
    }
  })

  return { linkFed, live }
}

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
  const { linkFed, live } = collectGraphTargets(graph)
  for (const [targetId, control] of store.getWidgetControls(
    graph.rootGraph.id
  )) {
    if (!live.has(targetId)) continue
    const target = store.getWidget(targetId)
    if (!target || linkFed.has(targetId)) continue

    if (phase === 'before') {
      const firstRun = !control.hasExecuted
      store.updateWidgetControl(targetId, { hasExecuted: true })
      if (firstRun) continue
    }

    const next = computeNextControlledValue(target, control.mode, {
      comboFilter: control.filter,
      nodeId: parseWidgetId(targetId).nodeId
    })
    if (next === undefined) continue

    store.setValue(targetId, next)
    live.get(targetId)?.callback?.(next)
  }
}
