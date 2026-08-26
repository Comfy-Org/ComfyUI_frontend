import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { normalizeControlOption } from '@/types/simplifiedWidget'
import type { SafeControlWidget } from '@/types/simplifiedWidget'
import type { WidgetId } from '@/types/widgetId'

import { parseValueControlMode } from './valueControl'

export function registerWidgetControlFromConfig(widget: IBaseWidget): void {
  const config = widget.controlConfig
  const targetId = widget.widgetId
  if (!config || !targetId) return

  useWidgetValueStore().registerWidgetControl(targetId, {
    mode: config.mode,
    filter: config.hasFilter ? (config.filter ?? '') : undefined
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
  target:
    | WidgetId
    | Pick<IBaseWidget, 'widgetId' | 'controlConfig'>
    | undefined,
  values: readonly unknown[],
  index: number,
  valueCount?: 0 | 1 | 2
): number {
  if (valueCount === 0) return index
  const targetId = typeof target === 'string' ? target : target?.widgetId
  const config = typeof target === 'string' ? undefined : target?.controlConfig
  const store = useWidgetValueStore()
  const control = targetId ? store.getWidgetControl(targetId) : undefined
  if (!control && !config) return index

  let next = index
  const mode = parseValueControlMode(values[next])
  if (!mode) return next

  if (config) config.mode = mode
  if (targetId) store.updateWidgetControl(targetId, { mode })
  next++
  if (valueCount === 1) return next
  const filter = values[next]
  if (
    (control?.filter !== undefined || config?.hasFilter) &&
    typeof filter === 'string'
  ) {
    if (config) config.filter = filter
    if (targetId) store.updateWidgetControl(targetId, { filter })
    next++
  }
  return next
}

export interface WidgetValueLayoutEntry {
  valueIndex: number
  controlValueCount: 0 | 1 | 2
}

interface WidgetValueLayoutCandidate {
  entries: WidgetValueLayoutEntry[]
  targetValueCount: number
  targetTypeMatchCount: number
  controlValueCount: number
}

function betterLayout(
  current: WidgetValueLayoutCandidate | undefined,
  candidate: WidgetValueLayoutCandidate | undefined
): WidgetValueLayoutCandidate | undefined {
  if (!candidate) return current
  if (!current) return candidate
  if (candidate.targetValueCount !== current.targetValueCount) {
    return candidate.targetValueCount > current.targetValueCount
      ? candidate
      : current
  }
  if (candidate.targetTypeMatchCount !== current.targetTypeMatchCount) {
    return candidate.targetTypeMatchCount > current.targetTypeMatchCount
      ? candidate
      : current
  }
  return candidate.controlValueCount > current.controlValueCount
    ? candidate
    : current
}

export function decodeWidgetValueLayout(
  widgets: readonly Pick<IBaseWidget, 'widgetId' | 'controlConfig'>[],
  values: readonly unknown[]
): WidgetValueLayoutEntry[] {
  const store = useWidgetValueStore()
  const memo = new Map<string, WidgetValueLayoutCandidate | null>()

  const decode = (
    widgetIndex: number,
    valueIndex: number
  ): WidgetValueLayoutCandidate | undefined => {
    const key = `${widgetIndex}:${valueIndex}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached ?? undefined

    if (widgetIndex === widgets.length) {
      const result =
        valueIndex === values.length
          ? {
              entries: [],
              targetValueCount: 0,
              targetTypeMatchCount: 0,
              controlValueCount: 0
            }
          : undefined
      memo.set(key, result ?? null)
      return result
    }

    if (valueIndex >= values.length) {
      const result = {
        entries: widgets
          .slice(widgetIndex)
          .map(() => ({ valueIndex, controlValueCount: 0 as const })),
        targetValueCount: 0,
        targetTypeMatchCount: 0,
        controlValueCount: 0
      }
      memo.set(key, result)
      return result
    }

    const widget = widgets[widgetIndex]
    const control =
      (widget.widgetId ? store.getWidgetControl(widget.widgetId) : undefined) ??
      widget.controlConfig
    const hasFilter =
      control && 'hasFilter' in control
        ? control.hasFilter
        : control?.filter !== undefined
    const target = widget.widgetId
      ? store.getWidget(widget.widgetId)
      : undefined
    const nextValueIndex = valueIndex + 1
    let best: WidgetValueLayoutCandidate | undefined

    const addCandidate = (controlValueCount: 0 | 1 | 2) => {
      const remainder = decode(
        widgetIndex + 1,
        nextValueIndex + controlValueCount
      )
      if (!remainder) return
      best = betterLayout(best, {
        entries: [{ valueIndex, controlValueCount }, ...remainder.entries],
        targetValueCount: remainder.targetValueCount + 1,
        targetTypeMatchCount:
          remainder.targetTypeMatchCount +
          (target?.value != null &&
          typeof target.value === typeof values[valueIndex]
            ? 1
            : 0),
        controlValueCount: remainder.controlValueCount + controlValueCount
      })
    }

    addCandidate(0)
    if (control && parseValueControlMode(values[nextValueIndex])) {
      addCandidate(1)
      if (hasFilter && typeof values[nextValueIndex + 1] === 'string') {
        addCandidate(2)
      }
    }

    memo.set(key, best ?? null)
    return best
  }

  return (
    decode(0, 0)?.entries ??
    widgets.map((_, valueIndex) => ({
      valueIndex,
      controlValueCount: 0
    }))
  )
}
