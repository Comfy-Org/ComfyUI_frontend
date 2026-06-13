import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export type ValueControlMode =
  | 'fixed'
  | 'increment'
  | 'increment-wrap'
  | 'decrement'
  | 'randomize'

/** Control modes offered for combo targets (combos add wrap-around). */
export const COMBO_CONTROL_MODES: readonly ValueControlMode[] = [
  'fixed',
  'increment',
  'increment-wrap',
  'decrement',
  'randomize'
]

/** Control modes offered for numeric targets. */
export const NUMBER_CONTROL_MODES: readonly ValueControlMode[] = [
  'fixed',
  'increment',
  'decrement',
  'randomize'
]

const VALUE_CONTROL_MODES: ReadonlySet<string> = new Set(COMBO_CONTROL_MODES)

export function isValueControlMode(value: unknown): value is ValueControlMode {
  return typeof value === 'string' && VALUE_CONTROL_MODES.has(value)
}

/**
 * The minimal widget shape needed to advance a controlled value. Matches both a
 * litegraph widget and a `WidgetState` row from the widget value store.
 */
interface ValueControlTarget {
  type: IBaseWidget['type']
  value?: unknown
  options: IBaseWidget['options']
}

const SAFE_INTEGER_MAX = 1125899906842624
const SAFE_INTEGER_MIN = -1125899906842624

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
  target: ValueControlTarget,
  mode: ValueControlMode,
  options: { comboFilter?: string; nodeId?: unknown } = {}
): IBaseWidget['value'] | undefined {
  if (mode === 'fixed') return undefined

  if (target.type === 'combo') {
    return computeNextComboValue(target, mode, options)
  }

  return computeNextNumberValue(target, mode)
}

function computeNextComboValue(
  target: ValueControlTarget,
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

function computeNextNumberValue(
  target: ValueControlTarget,
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
