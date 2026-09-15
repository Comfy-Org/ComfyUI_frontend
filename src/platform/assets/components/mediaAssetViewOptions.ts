export const MEDIA_ASSET_GRID_MODE = {
  gridSmall: 'grid-small',
  grid: 'grid'
} as const

export const MEDIA_ASSET_VIEW_MODE = {
  list: 'list',
  ...MEDIA_ASSET_GRID_MODE
} as const

// TODO: Introduce a shared ValueOf<T> for object-value unions across the codebase.
export type MediaAssetGridMode =
  (typeof MEDIA_ASSET_GRID_MODE)[keyof typeof MEDIA_ASSET_GRID_MODE]

export type MediaAssetViewMode =
  (typeof MEDIA_ASSET_VIEW_MODE)[keyof typeof MEDIA_ASSET_VIEW_MODE]

export function getMediaAssetGridColumns(mode: MediaAssetGridMode): string {
  const minWidth = mode === MEDIA_ASSET_GRID_MODE.gridSmall ? 128 : 240
  return `repeat(auto-fill, minmax(min(${minWidth}px, 30vw), 1fr))`
}
