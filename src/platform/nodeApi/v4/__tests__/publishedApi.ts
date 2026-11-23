import { assert } from 'vitest'

import { useComfyApiStore } from '@/platform/nodeApi/v4/comfyApiStore'
import type { Comfy } from '@/platform/nodeApi/v4/types'

/** Publishes the app's node API as the app does, and gives it. */
export function publishedApi(): Comfy {
  useComfyApiStore().publish()
  const comfy = window.comfy_v4
  assert(comfy, 'the node API was not published')
  return comfy
}
