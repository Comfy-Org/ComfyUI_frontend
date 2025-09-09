import { type CSSProperties, type ComputedRef, computed } from 'vue'

interface PopoverSizeOptions {
  minWidth?: string
  maxWidth?: string
}

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

    if (!minWidth && !maxWidth) {
      return {}
    }

    return {
      minWidth: minWidth || 'auto',
      maxWidth: maxWidth || 'auto'
    }
  })
}
