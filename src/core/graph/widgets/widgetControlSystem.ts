import {
  computeNextControlledValue,
  isValueControlMode
} from './control/valueControl'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { UUID } from '@/utils/uuid'
import { parseWidgetId } from '@/types/widgetId'

export type WidgetControlPhase = 'before' | 'after'

/** Advances the graph's controlled widget store values at the given queue phase. */
export function runWidgetControl(
  graphId: UUID,
  phase: WidgetControlPhase,
  { isPartialExecution }: { isPartialExecution?: boolean } = {}
): void {
  if (isPartialExecution) return

  const runBefore =
    useSettingStore().get('Comfy.WidgetControlMode') === 'before'
  if (phase === 'before' && !runBefore) return
  if (phase === 'after' && runBefore) return

  const store = useWidgetValueStore()
  for (const [targetId, control] of store.getWidgetControls(graphId)) {
    const target = store.getWidget(targetId)
    if (!target || target.inputLinked) continue

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
