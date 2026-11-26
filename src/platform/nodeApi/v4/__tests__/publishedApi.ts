import { assert, onTestFinished } from 'vitest'

import { useComfyApiStore } from '@/platform/nodeApi/v4/comfyApiStore'
import type { Comfy } from '@/platform/nodeApi/v4/types'

function restoreWindowApiAfterTest(): void {
  const original = Object.getOwnPropertyDescriptor(window, 'comfy_v4')
  onTestFinished(() => {
    if (original) Object.defineProperty(window, 'comfy_v4', original)
    else delete window.comfy_v4
  })
}

export function publishedApi(): Comfy {
  restoreWindowApiAfterTest()
  useComfyApiStore().publish()
  const comfy = window.comfy_v4
  assert(comfy, 'the node API was not published')
  return comfy
}

export function withoutPublishedApi(): void {
  restoreWindowApiAfterTest()
  delete window.comfy_v4
}
