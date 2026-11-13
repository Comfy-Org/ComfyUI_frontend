import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import { apiOnTestCanvas } from '@/platform/nodeApi/v4/events/__tests__/testCanvasSource'

function nodeOnCanvas() {
  stubCanvasGetContext()
  const graph = new LGraph()
  const node = new LGraphNode('Anchored')
  node.addInput('in', 'INT')
  node.addOutput('out', 'INT')
  node.addOutput('second', 'INT')
  graph.add(node)
  const element = document.createElement('canvas')
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 10, y: 20, width: 400, height: 200 })
  )
  const canvas = new LGraphCanvas(element, graph, { skip_render: true })
  document.body.append(element)
  onTestFinished(() => element.remove())
  const { comfy, useCanvas } = apiOnTestCanvas(graph)
  useCanvas(canvas)
  const handle = comfy.graph.node(String(node.id))
  assert(handle)
  return { graph, node, canvas, comfy, handle }
}

describe('node.getScreenRect', () => {
  it('maps the node bounds through the pan and zoom onto the page, frozen', () => {
    const { canvas, handle } = nodeOnCanvas()
    canvas.ds.scale = 2
    canvas.ds.offset[0] = 5
    canvas.ds.offset[1] = -5
    const bounds = handle.getBounds()
    assert(bounds)

    const rect = handle.getScreenRect()

    expect(rect).toEqual({
      x: (bounds.x + 5) * 2 + 10,
      y: (bounds.y - 5) * 2 + 20,
      width: bounds.width * 2,
      height: bounds.height * 2
    })
    expect(Object.isFrozen(rect)).toBe(true)
  })

  it('is undefined when the node is not on screen, is gone, or there is no canvas', () => {
    const { graph, node, canvas, handle } = nodeOnCanvas()

    canvas.graph = new LGraph()
    expect(handle.getScreenRect()).toBeUndefined()

    canvas.graph = graph
    graph.remove(node)
    expect(handle.getScreenRect()).toBeUndefined()

    const other = new LGraph()
    other.add(new LGraphNode('Elsewhere'))
    const { comfy } = createComfyApi({ getGraph: () => other })
    expect(comfy.graph.nodes()[0].getScreenRect()).toBeUndefined()
  })
})

describe('node.getSlotPosition', () => {
  it('gives where each side’s slot sits in graph space, frozen', () => {
    const { node, handle } = nodeOnCanvas()
    const [inX, inY] = node.getInputPos(0)
    const [outX, outY] = node.getOutputPos(0)

    const input = handle.getSlotPosition('input', 0)

    expect(input).toEqual({ x: inX, y: inY })
    expect(handle.getSlotPosition('output', 0)).toEqual({ x: outX, y: outY })
    expect(Object.isFrozen(input)).toBe(true)
  })

  it('is undefined for a slot the node does not have, or a node that is gone', () => {
    const { graph, node, handle } = nodeOnCanvas()

    expect(handle.getSlotPosition('input', 1)).toBeUndefined()
    expect(handle.getSlotPosition('output', 1)).toEqual({
      x: node.getOutputPos(1)[0],
      y: node.getOutputPos(1)[1]
    })

    graph.remove(node)

    expect(handle.getSlotPosition('input', 0)).toBeUndefined()
  })

  it.for([
    ['left', 0],
    ['input', -1],
    ['input', 0.5],
    ['input', '0']
  ] as const)('refuses %s, %s', ([side, index]) => {
    const { handle } = nodeOnCanvas()

    expect(() =>
      Reflect.apply(handle.getSlotPosition, handle, [side, index])
    ).toThrow(/^getSlotPosition needs /)
  })
})
