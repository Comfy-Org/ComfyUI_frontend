import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'

import { isValueControlMode } from './valueControl'

/**
 * Appends a target's control values to `widgets_values`, preserving the classic
 * positional layout `[target, mode, filter?]` now that control is a component
 * rather than a widget. Inverse of {@link applyControlValues}.
 */
export function appendControlValues(
  targetId: WidgetId | undefined,
  values: unknown[]
): void {
  if (!targetId) return
  const control = useWidgetValueStore().getWidgetControl(targetId)
  if (!control) return
  values.push(control.mode)
  if (control.filter !== undefined) values.push(control.filter)
}

/**
 * Reads control values back from `widgets_values` at `index`, consuming the same
 * slots {@link appendControlValues} writes, and returns the next index.
 */
export function applyControlValues(
  targetId: WidgetId | undefined,
  values: readonly unknown[],
  index: number
): number {
  if (!targetId) return index
  const store = useWidgetValueStore()
  const control = store.getWidgetControl(targetId)
  if (!control) return index

  let next = index
  if (next < values.length) {
    const mode = values[next++]
    if (isValueControlMode(mode)) store.setControlMode(targetId, mode)
  }
  if (control.filter !== undefined && next < values.length) {
    const filter = values[next++]
    if (typeof filter === 'string') store.setControlFilter(targetId, filter)
  }
  return next
}
