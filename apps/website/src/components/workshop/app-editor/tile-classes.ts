export type TileAspect = 'video' | 'square' | 'photo'

export const TILE_ASPECT = {
  video: 'aspect-video',
  square: 'aspect-square',
  photo: 'aspect-3/2'
} as const satisfies Record<TileAspect, string>

/** A tile's caption: larger under the big tiles of a two-column grid. */
export function tileCaption(large: boolean): string {
  return large ? 'px-1 text-sm' : 'text-[11px] tracking-tight'
}
