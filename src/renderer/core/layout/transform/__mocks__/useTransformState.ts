import { onTestFinished, vi } from 'vitest'
import { computed, reactive, readonly } from 'vue'

import type { useTransformState as realUseTransformState } from '@/renderer/core/layout/transform/useTransformState'

function reactiveDefaults() {
  return {
    camera: readonly(reactive({ x: 0, y: 0, z: 1 })),
    transformStyle: computed(() => ({
      translate: '0px 0px',
      scale: '1 1 1',
      transformOrigin: '0 0'
    }))
  }
}

const transformState: ReturnType<typeof realUseTransformState> = {
  ...reactiveDefaults(),
  syncWithCanvas: vi.fn(),
  screenToCanvas: vi.fn(({ x, y }) => ({ x, y }))
}

export const useTransformState = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(transformState, reactiveDefaults())
  })
  return transformState
})
