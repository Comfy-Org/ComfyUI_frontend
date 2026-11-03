import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { normalizeControlOption } from '@/types/simplifiedWidget'
import type { SafeControlWidget } from '@/types/simplifiedWidget'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

import { parseValueControlMode } from './valueControl'
import { getControlProjections } from './controlProjection'

export function registerWidgetControlFromConfig(widget: IBaseWidget): void {
  const config = widget.controlConfig
  const targetId = widget.widgetId
  if (!targetId) return
  if (!config) {
    useWidgetValueStore().deleteWidgetControl(targetId)
    return
  }

  useWidgetValueStore().registerWidgetControl(targetId, {
    mode: config.mode,
    filter: config.hasFilter ? (config.filter ?? '') : undefined
  })
}

export function getWidgetControlView(
  widget: IBaseWidget
): SafeControlWidget | undefined {
  const targetId = widget.widgetId
  if (!targetId) return undefined
  const store = useWidgetValueStore()
  const control = store.getWidgetControl(targetId)
  if (!control) return undefined
  return {
    value: normalizeControlOption(control.mode),
    update: (value) => {
      const mode = normalizeControlOption(value)
      const [projection] = getControlProjections(widget)
      if (projection) projection.value = mode
    }
  }
}

export function appendControlValues(
  target:
    | WidgetId
    | Pick<IBaseWidget, 'widgetId' | 'controlConfig'>
    | undefined,
  values: unknown[]
): void {
  const targetId = typeof target === 'string' ? target : target?.widgetId
  const control =
    (targetId ? useWidgetValueStore().getWidgetControl(targetId) : undefined) ??
    (typeof target === 'string' ? undefined : target?.controlConfig)
  if (!control) return
  values.push(control.mode)
  const filter =
    'hasFilter' in control
      ? control.hasFilter
        ? (control.filter ?? '')
        : undefined
      : control.filter
  if (filter !== undefined) values.push(filter)
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

  const mode = parseValueControlMode(values[index])
  if (!mode) return index

  const filter = values[index + 1]
  const restoreFilter =
    valueCount !== 1 &&
    (control?.filter !== undefined || config?.hasFilter === true) &&
    typeof filter === 'string'
  const restored = restoreFilter ? { mode, filter } : { mode }
  if (config) Object.assign(config, restored)
  if (targetId) store.updateWidgetControl(targetId, restored)
  return index + 1 + Number(restoreFilter)
}

export interface WidgetValueLayoutEntry {
  valueIndex: number
  controlValueCount: 0 | 1 | 2
}

interface WidgetValueLayoutCandidate {
  entries: WidgetValueLayoutEntry[]
  preferredControlValueCount: number
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
  if (
    candidate.preferredControlValueCount !== current.preferredControlValueCount
  ) {
    return candidate.preferredControlValueCount >
      current.preferredControlValueCount
      ? candidate
      : current
  }
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
  values: readonly unknown[],
  preferControlValuesFor?: ReadonlySet<
    Pick<IBaseWidget, 'widgetId' | 'controlConfig'>
  >
): WidgetValueLayoutEntry[] {
  const store = useWidgetValueStore()
  const memo = new Map<string, WidgetValueLayoutCandidate | null>()
  const constraints = widgets.map((widget) => {
    const control =
      (widget.widgetId ? store.getWidgetControl(widget.widgetId) : undefined) ??
      widget.controlConfig
    return {
      hasControl: !!control,
      hasFilter:
        control && 'hasFilter' in control
          ? control.hasFilter
          : control?.filter !== undefined,
      targetValue: widget.widgetId
        ? store.getWidget(widget.widgetId)?.value
        : undefined,
      preferControlValues: preferControlValuesFor?.has(widget)
    }
  })

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
              preferredControlValueCount: 0,
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
        preferredControlValueCount: 0,
        targetValueCount: 0,
        targetTypeMatchCount: 0,
        controlValueCount: 0
      }
      memo.set(key, result)
      return result
    }

    const { hasControl, hasFilter, targetValue, preferControlValues } =
      constraints[widgetIndex]
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
        preferredControlValueCount:
          remainder.preferredControlValueCount +
          (preferControlValues ? controlValueCount : 0),
        targetValueCount: remainder.targetValueCount + 1,
        targetTypeMatchCount:
          remainder.targetTypeMatchCount +
          (targetValue != null &&
          typeof targetValue === typeof values[valueIndex]
            ? 1
            : 0),
        controlValueCount: remainder.controlValueCount + controlValueCount
      })
    }

    addCandidate(0)
    if (hasControl && parseValueControlMode(values[nextValueIndex])) {
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
