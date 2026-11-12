import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { useRafFn } from '@vueuse/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import SelectionRectangle from './SelectionRectangle.vue'

type RafCallback = Parameters<typeof useRafFn>[0]

const rafCallbacks: RafCallback[] = []
vi.mock(import('@vueuse/core'), { spy: true })

function dragRectangle(eDown: [number, number], eMove: [number, number]) {
  useCanvasStore().canvas = fromPartial({
    dragging_rectangle: [
      eDown[0],
      eDown[1],
      eMove[0] - eDown[0],
      eMove[1] - eDown[1]
    ],
    pointer: {
      eDown: { safeOffsetX: eDown[0], safeOffsetY: eDown[1] },
      eMove: { safeOffsetX: eMove[0], safeOffsetY: eMove[1] }
    }
  })
  rafCallbacks[rafCallbacks.length - 1](
    fromPartial({ delta: 0, timestamp: performance.now() })
  )
}

describe('SelectionRectangle', () => {
  beforeEach(() => {
    vi.mocked(useRafFn).mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return fromPartial({ pause: vi.fn(), resume: vi.fn() })
    })
  })

  afterEach(() => {
    rafCallbacks.length = 0
    useCanvasStore().canvas = null
  })

  it.for([
    { direction: 'down-and-right', eDown: [100, 50], eMove: [800, 400] },
    { direction: 'up-and-left', eDown: [800, 400], eMove: [100, 50] }
  ] as const)(
    'spans the full drag when dragged $direction',
    async ({ eDown, eMove }) => {
      render(SelectionRectangle)

      dragRectangle([...eDown], [...eMove])
      await nextTick()

      const rect = screen.getByTestId('selection-rectangle')
      expect(rect.style.left).toBe('100px')
      expect(rect.style.top).toBe('50px')
      expect(rect.style.width).toBe('700px')
      expect(rect.style.height).toBe('350px')
    }
  )
})
