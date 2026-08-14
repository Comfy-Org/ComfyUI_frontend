import type * as VueUse from '@vueuse/core'
import { effectScope, shallowRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

import { shouldUseVueNodeLowDetail, useVueNodeLOD } from './useVueNodeLOD'

const rafWatcher = vi.hoisted(() => ({
  callback: undefined as Parameters<typeof VueUse.useRafFn>[0] | undefined
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const vueUse = await importOriginal<typeof VueUse>()
  return {
    ...vueUse,
    useRafFn: vi.fn((callback: Parameters<typeof VueUse.useRafFn>[0]) => {
      rafWatcher.callback = callback
      return {
        isActive: true,
        pause: vi.fn(),
        resume: vi.fn()
      }
    })
  }
})

describe('shouldUseVueNodeLowDetail', () => {
  it('uses low detail strictly below the percentage threshold', () => {
    expect(shouldUseVueNodeLowDetail(0.949, true, 95, true)).toBe(true)
    expect(shouldUseVueNodeLowDetail(0.95, true, 95, true)).toBe(false)
  })

  it('requires LOD and Vue nodes to be enabled', () => {
    expect(shouldUseVueNodeLowDetail(0.5, false, 95, true)).toBe(false)
    expect(shouldUseVueNodeLowDetail(0.5, true, 95, false)).toBe(false)
  })

  it('rejects non-finite canvas scales', () => {
    expect(shouldUseVueNodeLowDetail(Number.NaN, true, 95, true)).toBe(false)
    expect(shouldUseVueNodeLowDetail(Infinity, true, 95, true)).toBe(false)
    expect(shouldUseVueNodeLowDetail(-Infinity, true, 95, true)).toBe(false)
  })

  it('clamps the supported threshold range', () => {
    expect(shouldUseVueNodeLowDetail(0.09, true, 0, true)).toBe(true)
    expect(shouldUseVueNodeLowDetail(0.1, true, 0, true)).toBe(false)
    expect(shouldUseVueNodeLowDetail(0.99, true, 200, true)).toBe(true)
    expect(shouldUseVueNodeLowDetail(1, true, 200, true)).toBe(false)
  })

  it('removes low detail when its effect scope stops', () => {
    const canvas = {
      ds: { scale: 0.5 }
    } as unknown as LGraphCanvas
    const scope = effectScope()
    try {
      scope.run(() =>
        useVueNodeLOD({
          canvas,
          enabled: true,
          fullDetailZoom: 95,
          vueNodesEnabled: true
        })
      )
      const callback = rafWatcher.callback
      if (!callback) throw new Error('RAF watcher callback was not captured')

      callback({ delta: 0, timestamp: 0 })
      expect(
        document.documentElement.classList.contains('vue-nodes-low-detail')
      ).toBe(true)
    } finally {
      scope.stop()
    }
    expect(
      document.documentElement.classList.contains('vue-nodes-low-detail')
    ).toBe(false)
  })

  it('re-evaluates replacement canvases and clears a missing canvas', () => {
    function createCanvas() {
      return { ds: { scale: 0.5 } } as unknown as LGraphCanvas
    }
    const canvas = shallowRef<LGraphCanvas | null>(createCanvas())
    let enabled = true
    const scope = effectScope()
    try {
      scope.run(() =>
        useVueNodeLOD({
          canvas,
          enabled: () => enabled,
          fullDetailZoom: 95,
          vueNodesEnabled: true
        })
      )
      const callback = rafWatcher.callback
      if (!callback) throw new Error('RAF watcher callback was not captured')

      callback({ delta: 0, timestamp: 0 })
      expect(
        document.documentElement.classList.contains('vue-nodes-low-detail')
      ).toBe(true)

      enabled = false
      canvas.value = createCanvas()
      callback({ delta: 0, timestamp: 16 })
      expect(
        document.documentElement.classList.contains('vue-nodes-low-detail')
      ).toBe(false)

      enabled = true
      canvas.value = createCanvas()
      callback({ delta: 0, timestamp: 32 })
      expect(
        document.documentElement.classList.contains('vue-nodes-low-detail')
      ).toBe(true)

      canvas.value = null
      callback({ delta: 0, timestamp: 48 })
      expect(
        document.documentElement.classList.contains('vue-nodes-low-detail')
      ).toBe(false)
    } finally {
      scope.stop()
    }
  })
})
