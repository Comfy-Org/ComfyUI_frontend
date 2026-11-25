import type { PopoverContentProps } from 'reka-ui'

export interface HSVA {
  h: number
  s: number
  v: number
  a: number
}

export interface ColorPickerOptions extends PopoverContentProps {
  triggerId?: string
  class?: string
  disabled?: boolean
  alpha?: boolean
  accessibleLabel?: string
}

export interface ColorPickerProps extends ColorPickerOptions {
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
