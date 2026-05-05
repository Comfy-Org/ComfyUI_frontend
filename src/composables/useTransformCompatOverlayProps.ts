import type { HintedString } from '@primevue/core'
import type { InjectionKey } from 'vue'
import { computed, inject } from 'vue'

/**
 * Options for configuring transform-compatible overlay props
 */
interface TransformCompatOverlayOptions {
  /**
   * Where to append the overlay. 'self' keeps overlay within component
   * for proper transform inheritance, 'body' teleports to document body
   */
  appendTo?: HintedString<'body' | 'self'> | undefined | HTMLElement
  // Future: other props needed for transform compatibility
  // scrollTarget?: string | HTMLElement
  // autoZIndex?: boolean
}

export const OverlayAppendToKey: InjectionKey<
  HintedString<'body' | 'self'> | undefined | HTMLElement
> = Symbol('OverlayAppendTo')

/**
 * Composable that provides props to make PrimeVue overlay components
 * compatible with CSS-transformed parent elements.
 *
 * Vue nodes use CSS transforms for positioning/scaling. PrimeVue overlay
 * components (Select, MultiSelect, TreeSelect, etc.) teleport to document
 * body by default, breaking transform inheritance. This composable provides
 * the necessary props to keep overlays within their component elements.
 *
 * @param overrides - Optional overrides for specific use cases
 * @returns Computed props object to spread on PrimeVue overlay components
 *
 * @example
 * ```vue
 * <template>
 *   <Select v-bind="overlayProps" />
 * </template>
 *
 * <script setup>
 * const overlayProps = useTransformCompatOverlayProps()
 * </script>
 * ```
 */
export function useTransformCompatOverlayProps(
  overrides: TransformCompatOverlayOptions = {}
) {
  const injectedAppendTo = inject(OverlayAppendToKey, undefined)

  return computed(() => ({
    appendTo: injectedAppendTo ?? ('self' as const),
    ...overrides
  }))
}
