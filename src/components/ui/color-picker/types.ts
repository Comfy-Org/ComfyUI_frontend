export interface ColorPickerProps {
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
