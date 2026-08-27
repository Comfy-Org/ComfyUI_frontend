import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/renderer/core/layout/store/layoutStore')

interface DirtyRequest {
  foreground: boolean
  background: boolean
  changedForeground: boolean
  changedBackground: boolean
}

class InvalidationProbe {
  readonly requests: DirtyRequest[] = []
  readonly drawSequence: ('background' | 'foreground')[] = []
  readonly foregroundDraw = vi.fn()
  readonly backgroundDraw = vi.fn()

  constructor(readonly canvas: LGraphCanvas) {
    const setDirty = canvas.setDirty.bind(canvas)
    vi.spyOn(canvas, 'setDirty').mockImplementation(
      (foreground, background) => {
        const wasForegroundDirty = canvas.dirty_canvas
        const wasBackgroundDirty = canvas.dirty_bgcanvas
        setDirty(foreground, background)
        this.requests.push({
          foreground,
          background: background ?? false,
          changedForeground: !wasForegroundDirty && canvas.dirty_canvas,
          changedBackground: !wasBackgroundDirty && canvas.dirty_bgcanvas
        })
      }
    )

    const drawForeground = canvas.drawFrontCanvas.bind(canvas)
    vi.spyOn(canvas, 'drawFrontCanvas').mockImplementation(() => {
      this.foregroundDraw()
      this.drawSequence.push('foreground')
      drawForeground()
    })

    const drawBackground = canvas.drawBackCanvas.bind(canvas)
    vi.spyOn(canvas, 'drawBackCanvas').mockImplementation(
      (redrawFrontCanvas) => {
        this.backgroundDraw()
        this.drawSequence.push('background')
        drawBackground(redrawFrontCanvas)
      }
    )
  }

  reset(): void {
    this.requests.length = 0
    this.drawSequence.length = 0
    this.foregroundDraw.mockClear()
    this.backgroundDraw.mockClear()
    this.canvas.dirty_canvas = false
    this.canvas.dirty_bgcanvas = false
  }
}

function createCanvas(): {
  canvas: LGraphCanvas
  graph: LGraph
} {
  const canvasElement = document.createElement('canvas')
  canvasElement.width = 800
  canvasElement.height = 600
  const foregroundContext = createMockCanvasRenderingContext2D()
  Object.defineProperty(foregroundContext, 'canvas', { value: canvasElement })
  foregroundContext.drawImage = vi.fn()
  canvasElement.getContext = vi.fn().mockReturnValue(foregroundContext)
  canvasElement.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => ({})
  })

  const graph = new LGraph()
  const canvas = new LGraphCanvas(canvasElement, graph, {
    skip_render: true,
    skip_events: true
  })
  const backgroundContext = createMockCanvasRenderingContext2D()
  Object.defineProperty(backgroundContext, 'canvas', {
    value: canvas.bgcanvas
  })
  canvas.bgctx = backgroundContext
  return { canvas, graph }
}

describe('LGraphCanvas invalidation scheduling baseline', () => {
  let canvas: LGraphCanvas
  let graph: LGraph
  let probe: InvalidationProbe

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    ;({ canvas, graph } = createCanvas())
    canvas.draw()
    probe = new InvalidationProbe(canvas)
    probe.reset()
  })

  it('coalesces a burst of foreground requests in the render loop', () => {
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback)
      return frames.length
    })
    canvas.startRendering()

    for (let i = 0; i < 100; i++) canvas.setDirty(true, false)

    expect(frames).toHaveLength(1)
    frames.shift()!(16)
    canvas.stopRendering()

    expect(probe.requests).toHaveLength(100)
    expect(
      probe.requests.filter((request) => request.changedForeground)
    ).toHaveLength(1)
    expect(frames).toHaveLength(1)
    expect(probe.foregroundDraw).toHaveBeenCalledTimes(1)
    expect(probe.backgroundDraw).not.toHaveBeenCalled()
  })

  it('does no layer work for an empty invalidation request', () => {
    canvas.setDirty(false, false)
    canvas.draw()

    expect(probe.requests).toHaveLength(1)
    expect(probe.requests[0].changedForeground).toBe(false)
    expect(probe.requests[0].changedBackground).toBe(false)
    expect(probe.drawSequence).toEqual([])
  })

  it('amplifies a background request into background then foreground draws', () => {
    canvas.setDirty(false, true)

    canvas.draw()

    expect(probe.drawSequence).toEqual(['background', 'foreground'])
    expect(canvas.dirty_canvas).toBe(false)
    expect(canvas.dirty_bgcanvas).toBe(false)
  })

  it('records layer transitions for setDirty flag combinations', () => {
    const requests: [boolean, boolean][] = [
      [true, false],
      [false, true],
      [true, true]
    ]

    for (const [foreground, background] of requests) {
      canvas.setDirty(foreground, background)
      canvas.draw()
    }

    expect(
      probe.requests.map(({ foreground, background }) => ({
        foreground,
        background
      }))
    ).toEqual(
      requests.map(([foreground, background]) => ({
        foreground,
        background
      }))
    )
    expect(probe.foregroundDraw).toHaveBeenCalledTimes(3)
    expect(probe.backgroundDraw).toHaveBeenCalledTimes(2)
  })

  it('draws both layers immediately when a synchronous draw forces them', () => {
    canvas.draw(true, true)

    expect(probe.requests).toHaveLength(0)
    expect(probe.foregroundDraw).toHaveBeenCalledTimes(1)
    expect(probe.backgroundDraw).toHaveBeenCalledTimes(1)
    expect(canvas.dirty_canvas).toBe(false)
    expect(canvas.dirty_bgcanvas).toBe(false)
  })

  it('draws a shared-canvas background request once without re-arming', () => {
    canvas.bgcanvas = canvas.canvas
    canvas.setDirty(false, true)

    canvas.draw()

    expect(probe.requests).toHaveLength(1)
    expect(probe.foregroundDraw).toHaveBeenCalledTimes(1)
    expect(probe.backgroundDraw).toHaveBeenCalledTimes(1)
    expect(probe.drawSequence).toEqual(['foreground', 'background'])
    expect(canvas.dirty_canvas).toBe(false)
    expect(canvas.dirty_bgcanvas).toBe(false)
  })

  it('preserves foreground invalidation requested during a shared draw', () => {
    canvas.bgcanvas = canvas.canvas
    let invalidateDuringDraw = true
    canvas.onDrawBackground = () => {
      if (!invalidateDuringDraw) return
      invalidateDuringDraw = false
      canvas.setDirty(true, false)
    }
    canvas.setDirty(false, true)

    canvas.draw()

    expect(canvas.dirty_canvas).toBe(true)
    expect(canvas.dirty_bgcanvas).toBe(false)

    canvas.draw()

    expect(probe.foregroundDraw).toHaveBeenCalledTimes(2)
    expect(probe.backgroundDraw).toHaveBeenCalledTimes(2)
    expect(canvas.dirty_canvas).toBe(false)
    expect(canvas.dirty_bgcanvas).toBe(false)
  })

  it('preserves background invalidation requested during a shared draw', () => {
    canvas.bgcanvas = canvas.canvas
    let invalidateDuringDraw = true
    canvas.onDrawBackground = () => {
      if (!invalidateDuringDraw) return
      invalidateDuringDraw = false
      canvas.setDirty(false, true)
    }
    canvas.setDirty(false, true)

    canvas.draw()

    expect(canvas.dirty_canvas).toBe(false)
    expect(canvas.dirty_bgcanvas).toBe(true)

    canvas.draw()

    expect(probe.foregroundDraw).toHaveBeenCalledTimes(2)
    expect(probe.backgroundDraw).toHaveBeenCalledTimes(2)
    expect(canvas.dirty_canvas).toBe(false)
    expect(canvas.dirty_bgcanvas).toBe(false)
  })

  it('forces both layers once when both layers use the same canvas', () => {
    canvas.bgcanvas = canvas.canvas

    canvas.draw(true, true)

    expect(probe.drawSequence).toEqual(['foreground', 'background'])
    expect(canvas.dirty_canvas).toBe(false)
    expect(canvas.dirty_bgcanvas).toBe(false)
  })

  it('keeps both shared-canvas connection passes when links are on top', () => {
    const drawConnections = vi.spyOn(canvas, 'drawConnections')
    canvas.bgcanvas = canvas.canvas
    graph.config.links_ontop = true
    canvas.setDirty(true, true)

    canvas.draw()

    expect(drawConnections).toHaveBeenCalledTimes(2)
    expect(canvas.dirty_canvas).toBe(false)
    expect(canvas.dirty_bgcanvas).toBe(false)
  })

  it('adds one connection pass per foreground draw when links are on top', () => {
    const drawConnections = vi.spyOn(canvas, 'drawConnections')
    graph.config.links_ontop = true
    canvas.setDirty(true, true)

    canvas.draw()

    expect(probe.foregroundDraw).toHaveBeenCalledTimes(1)
    expect(probe.backgroundDraw).toHaveBeenCalledTimes(1)
    expect(drawConnections).toHaveBeenCalledTimes(2)
  })

  it('keeps graph and node compatibility wrappers argument-transparent', () => {
    const node = new LGraphNode('Node')
    graph.add(node)
    probe.reset()
    graph.setDirtyCanvas(false, true)
    node.setDirtyCanvas(true, false)

    expect(probe.requests).toEqual([
      {
        foreground: false,
        background: true,
        changedForeground: false,
        changedBackground: true
      },
      {
        foreground: true,
        background: false,
        changedForeground: true,
        changedBackground: false
      }
    ])
  })

  it('redraws both layers on each animation tick', () => {
    canvas.always_render_background = true

    canvas.draw()
    canvas.draw()

    expect(probe.requests).toHaveLength(0)
    expect(probe.foregroundDraw).toHaveBeenCalledTimes(2)
    expect(probe.backgroundDraw).toHaveBeenCalledTimes(2)
  })

  it('redraws a shared canvas once per animation tick', () => {
    canvas.bgcanvas = canvas.canvas
    canvas.always_render_background = true

    canvas.draw()
    canvas.draw()

    expect(probe.foregroundDraw).toHaveBeenCalledTimes(2)
    expect(probe.backgroundDraw).toHaveBeenCalledTimes(2)
    expect(canvas.dirty_canvas).toBe(false)
    expect(canvas.dirty_bgcanvas).toBe(false)
  })
})
