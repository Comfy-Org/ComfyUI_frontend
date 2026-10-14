import { shallowRef, watch } from 'vue'

import type { SpriteStyle } from '@/lib/workshop/sprite-sheet/options'
import { renderStyleThumbnails } from '@/lib/workshop/sprite-sheet/render-sheet'

type Thumbnails = Partial<Record<SpriteStyle, string>>

const cache = new Map<string, Thumbnails>()

/**
 * The character drawn in each style, small, for the style tiles. Empty
 * where a 2D canvas is missing; the tiles fall back to the character.
 */
export function useStyleThumbnails(url: () => string | undefined) {
  const thumbnails = shallowRef<Thumbnails>({})

  watch(
    url,
    async (source) => {
      const known = source ? cache.get(source) : undefined
      thumbnails.value = known ?? {}
      if (!source || known) return
      const made = (await renderStyleThumbnails(source)) ?? {}
      cache.set(source, made)
      if (url() === source) thumbnails.value = made
    },
    { immediate: true }
  )

  return thumbnails
}
