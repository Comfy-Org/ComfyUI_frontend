import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import type { WidgetValue } from '@comfyorg/graph-model/widgetValue'

import { IS_CONTROL_WIDGET } from './controlWidgetMarker'

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

function normalizeControlOption(val: WidgetValue): ControlOptions {
  if (isControlOption(val)) return val
  return 'randomize'
}

export type SafeControlWidget = {
  value: ControlOptions
  update: (value: WidgetValue) => void
}

export function getControlWidget(
  widget: IBaseWidget
): SafeControlWidget | undefined {
  const controlWidget = widget.linkedWidgets?.find((w) => w[IS_CONTROL_WIDGET])
  if (!controlWidget) return
  return {
    value: normalizeControlOption(controlWidget.value),
    update: (value) => (controlWidget.value = normalizeControlOption(value))
  }
}
