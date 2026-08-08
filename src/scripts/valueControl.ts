import { isComboWidget } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  IWidgetOptions
} from '@/lib/litegraph/src/types/widgets'

import { IS_CONTROL_WIDGET } from './controlWidgetMarker'

type ValueControlMode =
  | 'fixed'
  | 'increment'
  | 'increment-wrap'
  | 'decrement'
  | 'randomize'

export function nextValueForLinkedTarget(params: {
  target: IBaseWidget
  linkedWidgets: IBaseWidget[] | undefined
  nodeId: unknown
  isPartialExecution: boolean | undefined
}): IBaseWidget['value'] | undefined {
  if (params.isPartialExecution) return undefined
  const linked = params.linkedWidgets
  if (!linked) return undefined

  const controlWidget = linked.find(isValueControlWidget)
  if (!controlWidget) return undefined

  const comboFilter = linked.find(
    (w) => w !== controlWidget && w.type === 'string'
  )
  const filterValue =
    typeof comboFilter?.value === 'string' ? comboFilter.value : undefined

  const mode = controlWidget.value as ValueControlMode
  return computeNextControlledValue(params.target, mode, {
    comboFilter: filterValue,
    nodeId: params.nodeId
  })
}

export const SAFE_INTEGER_MAX = 1125899906842624
const SAFE_INTEGER_MIN = -1125899906842624

export function isValueControlWidget(widget: IBaseWidget): boolean {
  return (
    (widget as Record<symbol, unknown>)[IS_CONTROL_WIDGET] === true &&
    typeof widget.beforeQueued === 'function' &&
    typeof widget.afterQueued === 'function'
  )
}

function buildComboFilter(
  filter: string | undefined,
  nodeId?: unknown
): ((item: string) => boolean) | undefined {
  if (!filter) return undefined

  if (filter.startsWith('/') && filter.endsWith('/')) {
    try {
      const regex = new RegExp(filter.substring(1, filter.length - 1))
      return (item: string) => regex.test(item)
    } catch (error) {
      console.error(
        'Error constructing RegExp filter for node ' + String(nodeId),
        filter,
        error
      )
    }
  }

  const lower = filter.toLocaleLowerCase()
  return (item: string) => item.toLocaleLowerCase().includes(lower)
}

export function computeNextControlledValue(
  target: IBaseWidget,
  mode: ValueControlMode,
  options: { comboFilter?: string; nodeId?: unknown } = {}
): IBaseWidget['value'] | undefined {
  if (mode === 'fixed') return undefined

  if (isComboWidget(target)) {
    return computeNextComboValue(target, mode, options)
  }

  return computeNextNumberValue(target, mode)
}

function computeNextComboValue(
  target: IBaseWidget,
  mode: ValueControlMode,
  { comboFilter, nodeId }: { comboFilter?: string; nodeId?: unknown }
): IBaseWidget['value'] | undefined {
  const rawValues = target.options.values
  if (!Array.isArray(rawValues)) return undefined

  const allValues = rawValues.filter(
    (value): value is string => typeof value === 'string'
  )
  const check = buildComboFilter(comboFilter, nodeId)
  const values = check ? allValues.filter(check) : allValues

  if (!values.length) {
    if (allValues.length) {
      console.warn(
        'Filter for node ' + String(nodeId) + ' has filtered out all items',
        comboFilter
      )
    }
    return undefined
  }

  let currentIndex = values.indexOf(target.value as string)
  const length = values.length

  switch (mode) {
    case 'increment':
      currentIndex += 1
      break
    case 'increment-wrap':
      currentIndex += 1
      if (currentIndex >= length) currentIndex = 0
      break
    case 'decrement':
      currentIndex -= 1
      break
    case 'randomize':
      currentIndex = Math.floor(Math.random() * length)
      break
  }

  currentIndex = Math.max(0, Math.min(length - 1, currentIndex))
  return values[currentIndex]
}

export function randomizeNumberValue(options: IWidgetOptions): number {
  const { min: rawMin = 0, max: rawMax = 1, step2 = 1 } = options
  const max = Math.min(SAFE_INTEGER_MAX, rawMax)
  const min = Math.max(SAFE_INTEGER_MIN, rawMin)
  const range = (max - min) / step2
  const next = Math.floor(Math.random() * range) * step2 + min
  return Math.min(Math.max(next, min), max)
}

function computeNextNumberValue(
  target: IBaseWidget,
  mode: ValueControlMode
): number | undefined {
  if (typeof target.value !== 'number') return undefined

  const { min: rawMin = 0, max: rawMax = 1, step2 = 1 } = target.options
  const max = Math.min(SAFE_INTEGER_MAX, rawMax)
  const min = Math.max(SAFE_INTEGER_MIN, rawMin)

  let next = target.value
  switch (mode) {
    case 'increment':
    case 'increment-wrap':
      next += step2
      break
    case 'decrement':
      next -= step2
      break
    case 'randomize':
      next = randomizeNumberValue(target.options)
      break
  }

  return Math.min(Math.max(next, min), max)
}
