/** Sidebar view mode: a list, or one of two grid tile sizes. */
export type MediaAssetViewMode = 'list' | 'grid-small' | 'grid-large'

/** `grid-template-columns` for a grid view mode ('list' falls back to the dense grid). */
export function gridColumnsForMode(mode: MediaAssetViewMode): string {
  const minWidth = mode === 'grid-large' ? 240 : 128
  return `repeat(auto-fill, minmax(min(${minWidth}px, 30vw), 1fr))`
}
