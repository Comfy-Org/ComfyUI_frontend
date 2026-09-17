import { afterEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

vi.mock(import('@/renderer/core/layout/store/layoutStore'))

describe('LGraphCanvas.deleteSelected', () => {
  let canvas: LGraphCanvas | undefined

  afterEach(() => {
    canvas?.unbindEvents()
    canvas?.canvas.remove()
  })

  it('closes the change when a node removal callback throws', () => {
    const graph = new LGraph()
    const element = document.createElement('canvas')
    element.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    document.body.append(element)
    canvas = new LGraphCanvas(element, graph, { skip_render: true })

    const node = new LGraphNode('test')
    graph.add(node)
    canvas.select(node)
    node.onRemoved = () => {
      throw new Error('extension failed')
    }

    const onChange = vi.fn()
    element.addEventListener('litegraph:canvas', onChange)
    expect(() => canvas?.deleteSelected()).toThrow('extension failed')
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ detail: { subType: 'before-change' } })
    )
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ detail: { subType: 'after-change' } })
    )
  })
})
