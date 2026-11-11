import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { runCanvasFramePhase } from '@/lib/litegraph/src/canvas/canvasFrame'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import SelectionRectangle from './SelectionRectangle.vue'

function dragRectangle(eDown: [number, number], eMove: [number, number]) {
  const canvas = fromPartial<LGraphCanvas>({
    canvas: document.createElement('canvas'),
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
  useCanvasStore().canvas = canvas
  return canvas
}

describe('SelectionRectangle', () => {
  afterEach(() => {
    useCanvasStore().canvas = null
  })

  it.for([
    { direction: 'down-and-right', eDown: [100, 50], eMove: [800, 400] },
    { direction: 'up-and-left', eDown: [800, 400], eMove: [100, 50] }
  ] as const)(
    'spans the full drag when dragged $direction',
    async ({ eDown, eMove }) => {
      render(SelectionRectangle)

      const canvas = dragRectangle([...eDown], [...eMove])
      await nextTick()
      runCanvasFramePhase(canvas, 'update')
      await nextTick()

      const rect = screen.getByTestId('selection-rectangle')
      expect(rect.style.left).toBe('100px')
      expect(rect.style.top).toBe('50px')
      expect(rect.style.width).toBe('700px')
      expect(rect.style.height).toBe('350px')
    }
  )
})
