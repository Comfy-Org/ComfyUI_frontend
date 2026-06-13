import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'

import { isValueControlMode } from './valueControl'

/**
 * Registers the control component for a target widget from its transient
 * `controlConfig`. Idempotent and safe to call before or after the widget is
 * bound to a node, so control registration follows the same deferral as value
 * registration.
 */
export function registerWidgetControlFromConfig(widget: IBaseWidget): void {
  const config = widget.controlConfig
  if (!config) return
  const targetId = widget.widgetId
  if (!targetId) return

  useWidgetValueStore().registerWidgetControl(targetId, {
    mode: config.mode,
    filter: config.hasFilter ? '' : undefined
  })
}

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
  const mode = values[next]
  if (!isValueControlMode(mode)) return next

  store.setControlMode(targetId, mode)
  next++
  const filter = values[next]
  if (control.filter !== undefined && typeof filter === 'string') {
    store.setControlFilter(targetId, filter)
    next++
  }
  return next
}
