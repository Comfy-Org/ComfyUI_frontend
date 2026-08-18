import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import NodeBoxOverlay from '@/renderer/extensions/vueNodes/components/NodeBoxOverlay.vue'

const callbacks = vi.hoisted(() => ({
  frame: vi.fn<() => void>(),
  resize: vi.fn<() => void>()
}))

vi.mock('@vueuse/core', () => ({
  useRafFn: (callback: () => void) =>
    callbacks.frame.mockImplementation(callback),
  useResizeObserver: (_target: unknown, callback: () => void) =>
    callbacks.resize.mockImplementation(callback)
}))

const camera = reactive({ x: -100, y: -50, z: 2 })

vi.mock('@/renderer/core/layout/transform/useTransformState', () => ({
  useTransformState: () => ({ camera })
}))

const originalDpr = window.devicePixelRatio

function setDpr(value: number): void {
  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    value
  })
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  Object.assign(camera, { x: -100, y: -50, z: 2 })
  setDpr(2)
})

afterEach(() => setDpr(originalDpr))

describe('NodeBoxOverlay', () => {
  it('draws the visible graph region once per render signature', async () => {
    const getBoxes = vi.fn(() => [])
    const context = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      restore: vi.fn(),
      save: vi.fn(),
      scale: vi.fn(),
      setTransform: vi.fn(),
      translate: vi.fn()
    }
    const { rerender } = render(NodeBoxOverlay, { props: { getBoxes } })
    const canvas = screen.getByTestId<HTMLCanvasElement>('node-box-overlay')
    Object.defineProperties(canvas, {
      clientHeight: { configurable: true, value: 200 },
      clientWidth: { configurable: true, value: 400 },
      getContext: { configurable: true, value: () => context }
    })

    callbacks.resize()
    callbacks.frame()

    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(400)
    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 400, 200)
    expect(getBoxes).toHaveBeenCalledWith({
      x: 100,
      y: 50,
      width: 200,
      height: 100
    })

    callbacks.frame()
    expect(getBoxes).toHaveBeenCalledOnce()

    await rerender({ contentVersion: 1, getBoxes })
    callbacks.frame()
    expect(getBoxes).toHaveBeenCalledTimes(2)
  })
})
