import type { HintedString } from '@primevue/core'
import { computed } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

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

/**
 * Composable that provides props to make PrimeVue overlay components
 * compatible with CSS-transformed parent elements.
 *
 * Vue nodes use CSS transforms for positioning/scaling. PrimeVue overlay
 * components (Select, MultiSelect, TreeSelect, etc.) teleport to document
 * body by default, breaking transform inheritance.
 *
 * When LiteGraph.ContextMenu.Scaling is enabled, overlays are appended to
 * 'self' to inherit canvas transforms and scale with the canvas. When disabled,
 * overlays are appended to 'body' to maintain fixed size regardless of canvas zoom.
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
  const settingStore = useSettingStore()

  return computed(() => {
    const contextMenuScaling = settingStore.get('LiteGraph.ContextMenu.Scaling')
    const appendTo = contextMenuScaling ? ('self' as const) : ('body' as const)

    return {
      appendTo,
      ...overrides
    }
  })
}
