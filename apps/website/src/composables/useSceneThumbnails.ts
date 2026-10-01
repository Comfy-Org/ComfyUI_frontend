import { onMounted, shallowRef } from 'vue'

import { renderSceneThumbnail } from '../lib/workshop/paparazzi-me/render'
import type { SceneId } from '../lib/workshop/paparazzi-me/setup'
import { SCENE_IDS } from '../lib/workshop/paparazzi-me/setup'

type Thumbnails = Partial<Record<SceneId, string>>

let cached: Thumbnails | undefined

/** Each preset scene's backdrop, drawn once; empty without a canvas. */
export function useSceneThumbnails() {
  const thumbnails = shallowRef<Thumbnails>(cached ?? {})
  onMounted(() => {
    cached ??= Object.fromEntries(
      SCENE_IDS.map((scene) => [scene, renderSceneThumbnail(scene)])
    )
    thumbnails.value = cached
  })
  return thumbnails
}
