import { computed } from 'vue'

/**
 * Props to keep PrimeVue overlays within CSS-transformed parent elements.
 */
export function useTransformCompatOverlayProps() {
  return computed(() => ({ appendTo: 'self' as const }))
}
