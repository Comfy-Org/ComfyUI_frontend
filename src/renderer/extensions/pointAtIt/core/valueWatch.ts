import type { StepWait } from './replyValidation'
import type { SettingValue } from './targetAddress'

/** A changed value counts once it has stayed put this long. */
export const SETTLE_MS = 600

export interface ValueWatch {
  baseline: SettingValue | undefined
  latest: SettingValue | undefined
  since: number
}

type Direction = Extract<StepWait, { for: 'valueChange' }>['direction']

export function startWatch(
  value: SettingValue | undefined,
  now: number
): ValueWatch {
  return { baseline: value, latest: value, since: now }
}

export function observeValue(
  watch: ValueWatch,
  value: SettingValue | undefined,
  now: number
): ValueWatch {
  return Object.is(value, watch.latest)
    ? watch
    : { ...watch, latest: value, since: now }
}

function movedAsAsked(watch: ValueWatch, direction: Direction): boolean {
  const { baseline, latest } = watch
  if (Object.is(baseline, latest)) return false
  if (!direction) return true
  if (typeof baseline !== 'number' || typeof latest !== 'number') return false
  return direction === 'increase' ? latest > baseline : latest < baseline
}

/** True once the value differs from where the step began, as asked, and has settled. */
export function hasSettled(
  watch: ValueWatch,
  direction: Direction,
  now: number
): boolean {
  return movedAsAsked(watch, direction) && now - watch.since >= SETTLE_MS
}
