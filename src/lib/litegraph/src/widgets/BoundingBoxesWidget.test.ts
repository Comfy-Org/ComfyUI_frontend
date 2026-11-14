import { describe, expect, it } from 'vitest'

import type { BoundingBox } from '@comfyorg/graph-model/boundingBoxes'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'

import { BoundingBoxesWidget } from './BoundingBoxesWidget'

describe('BoundingBoxesWidget', () => {
  it('has the boundingboxes type and draws the Vue-only placeholder', () => {
    const node = new LGraphNode('Test')
    const widget = new BoundingBoxesWidget(
      {
        type: 'boundingboxes',
        name: 'editor_state',
        value: [],
        options: {},
        y: 0
      },
      node
    )
    expect(widget.type).toBe('boundingboxes')
    const ctx = createMockCanvasRenderingContext2D()
    widget.drawWidget(ctx, { width: 200 })
    expect(ctx.fillText).toHaveBeenCalled()
    expect(() => widget.onClick({} as never)).not.toThrow()
  })

  it.for([
    { maxBoxes: undefined, assigned: 5, kept: 5 },
    { maxBoxes: 3, assigned: 2, kept: 2 },
    { maxBoxes: 3, assigned: 5, kept: 3 }
  ])(
    'keeps $kept of $assigned assigned boxes with a limit of $maxBoxes',
    ({ maxBoxes, assigned, kept }) => {
      const widget = new BoundingBoxesWidget(
        {
          type: 'boundingboxes',
          name: 'editor_state',
          value: [],
          options: { max_boxes: maxBoxes },
          y: 0
        },
        new LGraphNode('Test')
      )
      const boxes: BoundingBox[] = Array.from({ length: assigned }, (_, i) => ({
        x: i,
        y: 0,
        width: 10,
        height: 10,
        metadata: { type: 'obj', text: '', desc: '', palette: [] }
      }))
      widget.value = boxes
      expect(widget.value).toEqual(boxes.slice(0, kept))
    }
  )
})
