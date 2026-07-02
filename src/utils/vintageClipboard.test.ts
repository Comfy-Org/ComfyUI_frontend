import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { deserialiseAndCreate } from '@/utils/vintageClipboard'

vi.mock('@/platform/telemetry/nodeAdded/nodeAddSource', () => ({
  withNodeAddSource: (_source: string, callback: () => void) => callback()
}))

function createNode() {
  const node = {
    pos: [0, 0],
    configure: vi.fn((info: { pos: [number, number] }) => {
      node.pos = [...info.pos]
    }),
    connect: vi.fn()
  }
  return node as unknown as LGraphNode
}

function createCanvas() {
  const graph = {
    beforeChange: vi.fn(),
    afterChange: vi.fn(),
    add: vi.fn()
  }
  return {
    graph,
    graph_mouse: [100, 200],
    emitBeforeChange: vi.fn(),
    emitAfterChange: vi.fn(),
    selectNodes: vi.fn()
  } as unknown as LGraphCanvas
}

describe('deserialiseAndCreate', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('does nothing for empty clipboard data', () => {
    const canvas = createCanvas()

    deserialiseAndCreate('', canvas)

    expect(canvas.emitBeforeChange).not.toHaveBeenCalled()
  })

  it('creates pasted nodes relative to the canvas pointer and connects links', () => {
    const canvas = createCanvas()
    const first = createNode()
    const second = createNode()
    vi.spyOn(LiteGraph, 'createNode')
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
    const data = JSON.stringify({
      nodes: [
        { type: 'First', pos: [10, 20] },
        { type: 'Second', pos: [30, 40] }
      ],
      links: [[0, 0, 1, 0]]
    })

    deserialiseAndCreate(data, canvas)

    expect(canvas.emitBeforeChange).toHaveBeenCalled()
    expect(canvas.graph.beforeChange).toHaveBeenCalled()
    expect(first.configure).toHaveBeenCalledWith({
      type: 'First',
      pos: [10, 20]
    })
    expect(second.configure).toHaveBeenCalledWith({
      type: 'Second',
      pos: [30, 40]
    })
    expect(first.pos).toEqual([100, 200])
    expect(second.pos).toEqual([120, 220])
    expect(canvas.graph.add).toHaveBeenNthCalledWith(1, first, true)
    expect(canvas.graph.add).toHaveBeenNthCalledWith(2, second, true)
    expect(first.connect).toHaveBeenCalledWith(0, second, 0)
    expect(canvas.selectNodes).toHaveBeenCalledWith([first, second])
    expect(canvas.graph.afterChange).toHaveBeenCalled()
    expect(canvas.emitAfterChange).toHaveBeenCalled()
  })

  it('skips nodes that cannot be created and warns for unresolved links', () => {
    const canvas = createCanvas()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const node = createNode()
    vi.spyOn(LiteGraph, 'createNode')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(node)
    const data = JSON.stringify({
      nodes: [
        { type: 'Missing', pos: [0, 0] },
        { type: 'Present', pos: [10, 10] }
      ],
      links: [[0, 0, 1, 0]]
    })

    deserialiseAndCreate(data, canvas)

    expect(canvas.graph.add).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('Warning, nodes missing on pasting')
    expect(canvas.emitAfterChange).toHaveBeenCalled()
  })
})
