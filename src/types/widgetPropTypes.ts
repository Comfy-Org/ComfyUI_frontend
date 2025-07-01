/**
 * Type definitions for widget component props
 *
 * These interfaces define the subset of PrimeVue component props that are exposed
 * for the node-based widget system. They exclude props that allow custom styling,
 * colors, arbitrary CSS, or could create chaotic interfaces.
 *
 * Based on the design authority at:
 * https://www.figma.com/design/CmhEJxo4oZSuYpqG1Yc39w/Nodes-V3?node-id=441-7806&m=dev
 */
import type { ToggleSwitchProps as PrimeVueToggleSwitchProps } from 'primevue/toggleswitch'

/**
 * Widget ToggleSwitch Component
 * Excludes: style, class, inputClass, inputStyle, dt, pt, ptOptions, unstyled
 *
 * These props are excluded from widget.options to prevent external styling overrides.
 * The widget component itself can still use these props internally for consistent styling.
 */
export type WidgetToggleSwitchProps = Omit<
  PrimeVueToggleSwitchProps,
  | 'style'
  | 'class'
  | 'inputClass'
  | 'inputStyle'
  | 'dt'
  | 'pt'
  | 'ptOptions'
  | 'unstyled'
>
