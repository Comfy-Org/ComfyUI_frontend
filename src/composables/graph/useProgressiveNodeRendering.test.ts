import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useProgressiveNodeRendering } from '@/composables/graph/useProgressiveNodeRendering'

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    setPendingSlotSync: vi.fn()
  }
}))

function makeNodes(count: number): VueNodeData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i)
  })) as VueNodeData[]
}

describe('useProgressiveNodeRendering', () => {
  let rafCallbacks: Array<() => void>
  let originalRAF: typeof globalThis.requestAnimationFrame
  let originalCancel: typeof globalThis.cancelAnimationFrame

  beforeEach(() => {
    rafCallbacks = []
    originalRAF = globalThis.requestAnimationFrame
    originalCancel = globalThis.cancelAnimationFrame

    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      const id = rafCallbacks.length + 1
      rafCallbacks.push(() => cb(performance.now()))
      return id
    })
    globalThis.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF
    globalThis.cancelAnimationFrame = originalCancel
  })

  it('renders all nodes immediately for small graphs', () => {
    const allNodes = ref(makeNodes(10))
    const { visibleNodes, start } = useProgressiveNodeRendering(allNodes)

    start()

    expect(visibleNodes.value).toHaveLength(10)
    expect(requestAnimationFrame).not.toHaveBeenCalled()
  })

  it('renders initial batch then progressively adds more', () => {
    const allNodes = ref(makeNodes(100))
    const { visibleNodes, start } = useProgressiveNodeRendering(allNodes)

    start()

    expect(visibleNodes.value.length).toBeLessThan(100)
    expect(visibleNodes.value.length).toBeGreaterThan(0)
    expect(requestAnimationFrame).toHaveBeenCalled()
  })

  it('renders all nodes after enough RAF frames', () => {
    const allNodes = ref(makeNodes(100))
    const { visibleNodes, start } = useProgressiveNodeRendering(allNodes)

    start()

    while (rafCallbacks.length > 0) {
      const cb = rafCallbacks.shift()!
      cb()
    }

    expect(visibleNodes.value).toHaveLength(100)
  })

  it('cancels in-flight rendering on reset', () => {
    const allNodes = ref(makeNodes(100))
    const { visibleNodes, start, reset } = useProgressiveNodeRendering(allNodes)

    start()
    expect(visibleNodes.value.length).toBeGreaterThan(0)

    reset()
    expect(visibleNodes.value).toHaveLength(0)
  })

  it('handles empty node list', () => {
    const allNodes = ref(makeNodes(0))
    const { visibleNodes, start } = useProgressiveNodeRendering(allNodes)

    start()

    expect(visibleNodes.value).toHaveLength(0)
  })

  it('tracks allNodes changes when not progressively rendering', async () => {
    const allNodes = ref(makeNodes(5))
    const { visibleNodes, start } = useProgressiveNodeRendering(allNodes)

    start()
    expect(visibleNodes.value).toHaveLength(5)

    allNodes.value = makeNodes(8)
    await nextTick()

    expect(visibleNodes.value).toHaveLength(8)
  })
})
