import { computed, ref } from 'vue'
import type { CSSProperties, ComputedRef, Ref } from 'vue'

interface PopoverSizeOptions {
  minWidth?: string
  maxWidth?: string
}

// Matches the highest existing Reka popover z-index (e.g. z-3000 on SearchAutocomplete).
const DIALOG_CHILD_Z_INDEX_FLOOR = 3000

/**
 * Composable for managing popover sizing styles
 * @param options Popover size configuration
 * @returns Computed style object for popover sizing
 */
export function usePopoverSizing(
  options: PopoverSizeOptions
): ComputedRef<CSSProperties> {
  return computed(() => {
    const { minWidth, maxWidth } = options
    const style: CSSProperties = {}

    if (minWidth) {
      style.minWidth = minWidth
    }

    if (maxWidth) {
      style.maxWidth = maxWidth
    }

    return style
  })
}

/**
 * Keeps portaled popovers above their containing dialog or overlay.
 */
export function useOverlayChildStyle(): {
  overlayScopeRef: Ref<HTMLElement | null>
  contentStyle: ComputedRef<CSSProperties>
} {
  const overlayScopeRef = ref<HTMLElement | null>(null)
  const contentStyle = computed<CSSProperties>(() => {
    const overlay = overlayScopeRef.value?.closest(
      '[data-reka-dialog-content], .p-overlay-mask'
    )
    if (!overlay) return {}

    const zIndex = Number.parseInt(getComputedStyle(overlay).zIndex, 10)
    if (!Number.isFinite(zIndex)) return {}

    return { zIndex: Math.max(DIALOG_CHILD_Z_INDEX_FLOOR, zIndex + 1) }
  })

  return { overlayScopeRef, contentStyle }
}
