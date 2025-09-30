/**
 * Simplified widget interface for Vue-based node rendering
 * Removes all DOM manipulation and positioning concerns
 */
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'

/** Valid types for widget values */
export type WidgetValue =
  | string
  | number
  | boolean
  | object
  | undefined
  | null
  | void
  | File[]

export interface SimplifiedWidget<
  T extends WidgetValue = WidgetValue,
  O = Record<string, any>
> {
  /** Display name of the widget */
  name: string

  /** Widget type identifier (e.g., 'STRING', 'INT', 'COMBO') */
  type: string

  /** Current value of the widget */
  value: T

  /** Localized display label (falls back to name if not provided) */
  label?: string

  /** Widget options including filtered PrimeVue props */
  options?: O

  /** Callback fired when value changes */
  callback?: (value: T) => void

  /** Optional input specification backing this widget */
  spec?: InputSpecV2

  /** Optional serialization method for custom value handling */
  serializeValue?: () => any

  /** Optional method to compute widget size requirements */
  computeSize?: () => { minHeight: number; maxHeight?: number }
}
