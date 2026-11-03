import type { PopoverContentProps } from 'reka-ui'

export interface HSVA {
  h: number
  s: number
  v: number
  a: number
}

export interface ColorPickerProps {
  triggerId?: string
  align?: PopoverContentProps['align']
  class?: string
  disabled?: boolean
  alpha?: boolean
  /** Defaults to the trigger's visible color value. */
  accessibleLabel?: string
  hexLabel: string
  rgbaLabel: string
  hueLabel: string
  alphaLabel: string
  redLabel: string
  greenLabel: string
  blueLabel: string
  saturationBrightnessLabel: string
  formatLabel: string
}
