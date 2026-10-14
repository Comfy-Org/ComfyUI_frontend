import { watchDebounced } from '@vueuse/core'
import { shallowRef } from 'vue'

import type { Light, MoodId, RelightScene } from '@/lib/workshop/relight/lights'
import { MOOD_IDS, moodLights } from '@/lib/workshop/relight/lights'
import { renderMoodThumbnails } from '@/lib/workshop/relight/render-image'

type Thumbnails = Partial<Record<MoodId, string>>

let cached: { key: string; thumbnails: Thumbnails } | undefined

const looks = MOOD_IDS.reduce<Partial<Record<MoodId, readonly Light[]>>>(
  (all, mood) => ({ ...all, [mood]: moodLights(mood, String) }),
  {}
)

/**
 * The photo relit in each mood, small, redrawn when the photo or the scene
 * changes. Empty where WebGL is missing; the tiles fall back to glows.
 */
export function useMoodThumbnails(
  url: () => string | undefined,
  scene: () => RelightScene
) {
  const thumbnails = shallowRef<Thumbnails>({})
  let ticket = 0

  watchDebounced(
    [url, scene],
    async ([source, current]) => {
      ticket += 1
      const mine = ticket
      if (!source) {
        thumbnails.value = {}
        return
      }
      const key = JSON.stringify([source, current])
      if (cached?.key === key) {
        thumbnails.value = cached.thumbnails
        return
      }
      const made = (await renderMoodThumbnails(source, looks, current)) ?? {}
      if (mine !== ticket) return
      cached = { key, thumbnails: made }
      thumbnails.value = made
    },
    { debounce: 200, immediate: true }
  )

  return thumbnails
}
