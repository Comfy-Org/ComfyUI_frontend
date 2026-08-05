export const MEDIA_ASSET_VIEW_MODE = {
  list: 'list',
  gridSmall: 'grid-small',
  grid: 'grid'
} as const

export type MediaAssetViewMode =
  (typeof MEDIA_ASSET_VIEW_MODE)[keyof typeof MEDIA_ASSET_VIEW_MODE]

export type MediaAssetGridMode = Exclude<
  MediaAssetViewMode,
  typeof MEDIA_ASSET_VIEW_MODE.list
>

export function getMediaAssetGridColumns(mode: MediaAssetGridMode): string {
  const minWidth = mode === MEDIA_ASSET_VIEW_MODE.gridSmall ? 128 : 240
  return `repeat(auto-fill, minmax(min(${minWidth}px, 30vw), 1fr))`
}
