export type MediaAssetViewMode = 'list' | MediaAssetGridMode

export type MediaAssetGridMode = 'grid' | 'grid-small'

export function getMediaAssetGridColumns(mode: MediaAssetGridMode): string {
  const minWidth = mode === 'grid-small' ? 128 : 240
  return `repeat(auto-fill, minmax(min(${minWidth}px, 30vw), 1fr))`
}
