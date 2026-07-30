import { afterEach, describe, expect, it, vi } from 'vitest'

import { CARD_WIDTH } from '@/platform/onboarding/coachmarkLayout'
import { toNodeId } from '@/types/nodeId'

const mocks = vi.hoisted(() => ({
  canvas: null as Record<string, unknown> | null
}))
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: () => false })
}))
vi.mock('@/scripts/app', () => ({
  app: {
    get canvas() {
      return mocks.canvas
    }
  }
}))

import { focusFill, frameNode } from './cameraFraming'

describe('focusFill', () => {
  it('caps a small node at the max focus scale', () => {
    const fill = focusFill([0, 0, 200, 100], { width: 1920, height: 1080 })
    expect(fill).toBeCloseTo((0.6 * 300) / 1080, 5)
  })

  it('leaves a card column free beside a wide node', () => {
    const viewport = { width: 1920, height: 1080 }
    const fill = focusFill([0, 0, 3000, 400], viewport)
    const scale = (fill * viewport.width) / 3000
    expect(scale * 3000).toBeLessThanOrEqual(viewport.width - CARD_WIDTH * 2)
  })
})

describe('frameNode', () => {
  afterEach(() => vi.restoreAllMocks())

  it('animates to the node with the computed zoom', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false
    } as MediaQueryList)
    const animateToBounds = vi.fn()
    mocks.canvas = {
      graph: {
        getNodeById: () => ({ boundingRect: [0, 0, 400, 200] })
      },
      canvas: { getBoundingClientRect: () => new DOMRect(0, 0, 1920, 1080) },
      ds: { fitToBounds: vi.fn() },
      setDirty: vi.fn(),
      animateToBounds
    }
    await frameNode(toNodeId(1), new AbortController().signal)
    expect(animateToBounds).toHaveBeenCalledWith([0, 0, 400, 200], {
      zoom: expect.any(Number),
      duration: 450
    })
  })

  it('does nothing without the node', async () => {
    const fitToBounds = vi.fn()
    mocks.canvas = {
      graph: { getNodeById: () => null },
      canvas: { getBoundingClientRect: () => new DOMRect(0, 0, 1920, 1080) },
      ds: { fitToBounds },
      setDirty: vi.fn(),
      animateToBounds: vi.fn()
    }
    await frameNode(toNodeId(1), new AbortController().signal)
    expect(fitToBounds).not.toHaveBeenCalled()
  })

  it('jumps instead of animating under reduced motion', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true
    } as MediaQueryList)
    const fitToBounds = vi.fn()
    const animateToBounds = vi.fn()
    mocks.canvas = {
      graph: {
        getNodeById: () => ({ boundingRect: [0, 0, 400, 200] })
      },
      canvas: { getBoundingClientRect: () => new DOMRect(0, 0, 1920, 1080) },
      ds: { fitToBounds },
      setDirty: vi.fn(),
      animateToBounds
    }
    await frameNode(toNodeId(1), new AbortController().signal)
    expect(fitToBounds).toHaveBeenCalled()
    expect(animateToBounds).not.toHaveBeenCalled()
  })
})
