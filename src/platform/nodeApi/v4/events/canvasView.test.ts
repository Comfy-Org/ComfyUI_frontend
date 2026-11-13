import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'

import { apiOnTestCanvas } from './__tests__/testCanvasSource'

function canvasOnScreen() {
  stubCanvasGetContext()
  const graph = new LGraph()
  const node = new LGraphNode('On screen')
  graph.add(node)
  const canvas = new LGraphCanvas(document.createElement('canvas'), graph, {
    skip_render: true
  })
  const api = apiOnTestCanvas(graph)
  api.useCanvas(canvas)
  return { graph, node, canvas, ...api }
}

function panBy(canvas: LGraphCanvas, x: number, y: number) {
  canvas.ds.offset[0] += x
  canvas.ds.offset[1] += y
  canvas.ds.computeVisibleArea(canvas.viewport)
}

describe('onViewportChanged', () => {
  it('fires when the view pans or zooms, and the canvas still hears it', () => {
    const { canvas, comfy } = canvasOnScreen()
    const redraw = vi.spyOn(canvas, 'setDirty')
    const changed = vi.fn()
    comfy.onViewportChanged(changed)

    panBy(canvas, 10, 0)
    canvas.ds.scale = 2
    canvas.ds.computeVisibleArea(canvas.viewport)

    expect(changed).toHaveBeenCalledTimes(2)
    expect(redraw).toHaveBeenCalledTimes(2)
  })

  it('follows the canvas the app shows', () => {
    const { graph, canvas, comfy, useCanvas } = canvasOnScreen()
    const changed = vi.fn()
    comfy.onViewportChanged(changed)
    const replacement = new LGraphCanvas(
      document.createElement('canvas'),
      graph,
      { skip_render: true }
    )

    useCanvas(replacement)
    panBy(replacement, 5, 5)

    expect(changed).toHaveBeenCalledOnce()

    panBy(canvas, 5, 5)

    expect(changed).toHaveBeenCalledOnce()
  })

  it('gives the canvas its own handler back when the last listener leaves', () => {
    const { canvas, comfy } = canvasOnScreen()
    const own = canvas.ds.onChanged
    const changed = vi.fn()
    const stopFirst = comfy.onViewportChanged(changed)
    const stopSecond = comfy.onViewportChanged(vi.fn())

    stopFirst()

    expect(canvas.ds.onChanged).not.toBe(own)

    stopSecond()
    stopSecond()
    panBy(canvas, 10, 0)

    expect(canvas.ds.onChanged).toBe(own)
    expect(changed).not.toHaveBeenCalled()
  })

  it('stays quiet once unsubscribed even when another handler was chained after it', () => {
    const { canvas, comfy } = canvasOnScreen()
    const changed = vi.fn()
    const stop = comfy.onViewportChanged(changed)
    const ours = canvas.ds.onChanged
    canvas.ds.onChanged = (scale, offset) =>
      ours?.call(canvas.ds, scale, offset)

    stop()
    panBy(canvas, 10, 0)

    expect(changed).not.toHaveBeenCalled()

    const again = vi.fn()
    comfy.onViewportChanged(again)
    panBy(canvas, 10, 0)

    expect(again).toHaveBeenCalledOnce()
  })

  it('refuses a listener that is not a function', () => {
    const { comfy } = canvasOnScreen()

    expect(() => Reflect.apply(comfy.onViewportChanged, comfy, [1])).toThrow(
      TypeError
    )
  })
})

describe('isInteracting', () => {
  it('is false before there is a canvas', () => {
    expect(createComfyApi({ getGraph: () => null }).comfy.isInteracting()).toBe(
      false
    )
    expect(apiOnTestCanvas(null).comfy.isInteracting()).toBe(false)
  })

  it('is true while a node is being resized', () => {
    const { node, canvas, comfy } = canvasOnScreen()

    expect(comfy.isInteracting()).toBe(false)

    canvas.resizing_node = node

    expect(comfy.isInteracting()).toBe(true)
  })

  it('is true while a widget is being dragged', () => {
    const { node, canvas, comfy } = canvasOnScreen()
    const widget = node.addWidget('number', 'value', 0, () => {})

    canvas.node_widget = [node, widget]

    expect(comfy.isInteracting()).toBe(true)
  })

  it('is true while a link is being dragged', () => {
    const { graph, node, canvas, comfy } = canvasOnScreen()
    const output = node.addOutput('out', 'INT')

    canvas.linkConnector.dragNewFromOutput(graph, node, output)

    expect(comfy.isInteracting()).toBe(true)
  })
})

describe('onViewportChanged before the renderer supplies a canvas', () => {
  it('hears nothing and still returns a disposer', () => {
    const { comfy } = createComfyApi({ getGraph: () => null })

    expect(() => comfy.onViewportChanged(vi.fn())()).not.toThrow()
  })
})
