/**
 * Simplified widget interface for Vue-based node rendering
 * Removes all DOM manipulation and positioning concerns
 */

export interface SimplifiedWidget<T = any, O = Record<string, any>> {
  /** Display name of the widget */
  name: string

  /** Widget type identifier (e.g., 'STRING', 'INT', 'COMBO') */
  type: string

  /** Current value of the widget */
  value: T

  /** Widget options including filtered PrimeVue props */
  options?: O

  /** Callback fired when value changes */
  callback?: (value: T) => void

  /** Optional serialization method for custom value handling */
  serializeValue?: () => any

  /** Optional method to compute widget size requirements */
  computeSize?: () => { minHeight: number; maxHeight?: number }
}
