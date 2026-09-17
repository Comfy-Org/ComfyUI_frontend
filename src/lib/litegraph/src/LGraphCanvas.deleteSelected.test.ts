import { afterEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

vi.mock(import('@/renderer/core/layout/store/layoutStore'))

describe('LGraphCanvas.deleteSelected', () => {
  let canvas: LGraphCanvas | undefined

  function createCanvas(): { graph: LGraph; element: HTMLCanvasElement } {
    const graph = new LGraph()
    const element = document.createElement('canvas')
    element.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    document.body.append(element)
    canvas = new LGraphCanvas(element, graph, { skip_render: true })
    return { graph, element }
  }

  afterEach(() => {
    canvas?.unbindEvents()
    canvas?.canvas.remove()
  })

  it('closes the change when a node removal callback throws', () => {
    const { graph, element } = createCanvas()

    const node = new LGraphNode('test')
    graph.add(node)
    canvas?.select(node)
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

  it('closes both changes when a before-change callback throws', () => {
    const { graph, element } = createCanvas()
    const afterChange = vi.spyOn(graph, 'afterChange')
    vi.spyOn(graph, 'beforeChange').mockImplementation(() => {
      throw new Error('before failed')
    })

    const onChange = vi.fn()
    element.addEventListener('litegraph:canvas', onChange)
    expect(() => canvas?.deleteSelected()).toThrow('before failed')
    expect(afterChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls.map(([event]) => event.detail.subType)).toEqual([
      'before-change',
      'after-change'
    ])
  })

  it('preserves the removal error when graph cleanup also throws', () => {
    const { graph, element } = createCanvas()
    const node = new LGraphNode('test')
    graph.add(node)
    canvas?.select(node)
    node.onRemoved = () => {
      throw new Error('extension failed')
    }
    vi.spyOn(graph, 'afterChange').mockImplementation(() => {
      throw new Error('cleanup failed')
    })

    const onChange = vi.fn()
    element.addEventListener('litegraph:canvas', onChange)
    expect(() => canvas?.deleteSelected()).toThrow('extension failed')
    expect(onChange.mock.calls.map(([event]) => event.detail.subType)).toEqual([
      'before-change',
      'after-change'
    ])
  })

  it('propagates a graph cleanup error when deletion succeeds', () => {
    const { graph, element } = createCanvas()
    vi.spyOn(graph, 'afterChange').mockImplementation(() => {
      throw new Error('cleanup failed')
    })

    const onChange = vi.fn()
    element.addEventListener('litegraph:canvas', onChange)
    expect(() => canvas?.deleteSelected()).toThrow('cleanup failed')
    expect(onChange.mock.calls.map(([event]) => event.detail.subType)).toEqual([
      'before-change',
      'after-change'
    ])
  })
})
