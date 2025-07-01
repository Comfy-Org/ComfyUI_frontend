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

/**
 * Allowed ToggleSwitch props that can be passed through widget options
 * (excludes style-related props that are filtered out)
 */
export type AllowedToggleSwitchProps = Pick<
  ToggleSwitchProps,
  | 'modelValue'
  | 'defaultValue'
  | 'name'
  | 'trueValue'
  | 'falseValue'
  | 'invalid'
  | 'disabled'
  | 'readonly'
  | 'tabindex'
  | 'inputId'
  | 'ariaLabelledby'
  | 'ariaLabel'
>
