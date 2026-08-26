import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { normalizeControlOption } from '@/types/simplifiedWidget'
import type { SafeControlWidget } from '@/types/simplifiedWidget'
import type { WidgetId } from '@/types/widgetId'

import { isValueControlMode } from './valueControl'

export function registerWidgetControlFromConfig(widget: IBaseWidget): void {
  const config = widget.controlConfig
  const targetId = widget.widgetId
  if (!config || !targetId) return

  useWidgetValueStore().registerWidgetControl(targetId, {
    mode: config.mode,
    filter: config.hasFilter ? '' : undefined
  })
}

export function getWidgetControlView(
  widget: Pick<IBaseWidget, 'widgetId'>
): SafeControlWidget | undefined {
  const targetId = widget.widgetId
  if (!targetId) return undefined
  const store = useWidgetValueStore()
  const control = store.getWidgetControl(targetId)
  if (!control) return undefined
  return {
    value: normalizeControlOption(control.mode),
    update: (value) => {
      store.updateWidgetControl(targetId, {
        mode: normalizeControlOption(value)
      })
    }
  }
}

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

  store.updateWidgetControl(targetId, { mode })
  next++
  const filter = values[next]
  if (control.filter !== undefined && typeof filter === 'string') {
    store.updateWidgetControl(targetId, { filter })
    next++
  }
  return next
}
