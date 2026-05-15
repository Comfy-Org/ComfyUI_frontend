import { isComboWidget } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { IS_CONTROL_WIDGET } from './controlWidgetMarker'

export type ValueControlMode =
  | 'fixed'
  | 'increment'
  | 'increment-wrap'
  | 'decrement'
  | 'randomize'

const SAFE_INTEGER_MAX = 1125899906842624
const SAFE_INTEGER_MIN = -1125899906842624

/**
 * Detects a "control after generate" widget — a combo widget marked with
 * {@link IS_CONTROL_WIDGET} that drives increment/decrement/randomize cycling
 * of a target widget via `beforeQueued`/`afterQueued` lifecycle hooks.
 */
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

/**
 * Pure helper: compute the next value a target widget should take given a
 * value-control mode (and optional combo filter). Returns `undefined` when
 * no change should be applied (mode is `fixed`, target is not a supported
 * type, or combo filter eliminates all candidates).
 *
 * Caller is responsible for assigning the returned value to the target and
 * invoking any callbacks/side effects.
 */
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
  const allValues = (target.options.values ?? []) as readonly string[]
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

function computeNextNumberValue(
  target: IBaseWidget,
  mode: ValueControlMode
): number | undefined {
  if (typeof target.value !== 'number') return undefined

  const { min: rawMin = 0, max: rawMax = 1, step2 = 1 } = target.options
  const max = Math.min(SAFE_INTEGER_MAX, rawMax)
  const min = Math.max(SAFE_INTEGER_MIN, rawMin)
  const range = (max - min) / step2

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
      next = Math.floor(Math.random() * range) * step2 + min
      break
  }

  return Math.min(Math.max(next, min), max)
}
