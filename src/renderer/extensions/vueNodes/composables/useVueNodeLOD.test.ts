import type * as VueUse from '@vueuse/core'
import { effectScope } from 'vue'
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

  it('requires both settings to be enabled', () => {
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

  it('keeps full detail across frames with an unchanged NaN scale', () => {
    const canvas = {
      ds: { scale: Number.NaN }
    } as unknown as LGraphCanvas
    const scope = effectScope()
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
    ).toBe(false)
    callback({ delta: 0, timestamp: 16 })
    expect(
      document.documentElement.classList.contains('vue-nodes-low-detail')
    ).toBe(false)
    scope.stop()
  })
})
