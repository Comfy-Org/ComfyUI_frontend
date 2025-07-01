/**
 * Type definitions for widget component props
 */

export interface ToggleSwitchProps {
  modelValue: string | boolean
  defaultValue?: string | boolean
  name?: string
  trueValue?: any
  falseValue?: any
  invalid?: boolean
  disabled?: boolean
  readonly?: boolean
  tabindex?: number
  inputId?: string
  ariaLabelledby?: string
  ariaLabel?: string
}
