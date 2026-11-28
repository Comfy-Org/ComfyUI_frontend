import type { WidgetValue } from '@comfyorg/graph-model/widgetValue'

export const CONTROL_OPTIONS = [
  'fixed',
  'increment',
  'decrement',
  'randomize'
] as const
export type ControlOptions = (typeof CONTROL_OPTIONS)[number]

export function isControlOption(value: unknown): value is ControlOptions {
  return CONTROL_OPTIONS.some((option) => option === value)
}

export function normalizeControlOption(val: WidgetValue): ControlOptions {
  if (isControlOption(val)) return val
  return 'randomize'
}

export type SafeControlWidget = {
  value: ControlOptions
  update: (value: WidgetValue) => void
}
