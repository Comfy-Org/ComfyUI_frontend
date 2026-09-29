import { SIDE_PANEL_SIZE } from '@/constants/splitterConstants'

/**
 * The sidebar's size (%) from a PrimeVue Splitter state saved before side
 * panels were pinned in pixels, or the default size when none is usable.
 */
export function savedSidebarPercent(
  splitterState: string | null,
  sidebarLocation: 'left' | 'right'
): number {
  try {
    const sizes: unknown = JSON.parse(splitterState ?? 'null')
    if (!Array.isArray(sizes)) return SIDE_PANEL_SIZE
    const size: unknown = sidebarLocation === 'left' ? sizes[0] : sizes.at(-1)
    return typeof size === 'number' && size > 0 && size < 100
      ? size
      : SIDE_PANEL_SIZE
  } catch {
    return SIDE_PANEL_SIZE
  }
}
