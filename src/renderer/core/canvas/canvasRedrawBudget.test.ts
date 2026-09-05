import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { useLitegraphSettings } from '@/platform/settings/composables/useLitegraphSettings'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { createMockCanvas2DContext } from '@/utils/__tests__/litegraphTestUtils'

const PROGRESS_EVENTS = 100

async function drawUntilNoLongerDirty(canvas: LGraphCanvas, maxFrames = 5) {
  for (
    let i = 0;
    i < maxFrames && (canvas.dirty_canvas || canvas.dirty_bgcanvas);
    i++
  ) {
    canvas.draw()
    await nextTick()
  }
}

function createMockCtx(owner: HTMLCanvasElement): CanvasRenderingContext2D {
  return createMockCanvas2DContext({
    canvas: owner,
    translate: vi.fn(),
    scale: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    closePath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    setTransform: vi.fn(),
    getTransform: vi
      .fn()
      .mockReturnValue({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    roundRect: vi.fn(),
    drawImage: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    isPointInStroke: vi.fn().mockReturnValue(false),
    createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    createPattern: vi.fn().mockReturnValue(null),
    globalAlpha: 1,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    imageSmoothingEnabled: true
  })
}

function addWidgetInputNode(graph: LGraph, x: number, y: number): LGraphNode {
  const node = new LGraphNode('WidgetInput')
  node.pos = [x, y]
  node.size = [200, 120]
  node.addWidget('number', 'value', 0, () => {})
  const input = node.addInput('value', 'FLOAT')
  input.widget = { name: 'value' }
  graph.add(node)
  return node
}

describe('canvas redraw budget while progress events stream in', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let previousVueNodesMode: boolean

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    previousVueNodesMode = LiteGraph.vueNodesMode
    LiteGraph.vueNodesMode = false

    const canvasElement = document.createElement('canvas')
    canvasElement.width = 1200
    canvasElement.height = 800
    canvasElement.getContext = vi
      .fn()
      .mockReturnValue(createMockCtx(canvasElement))
    canvasElement.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      width: 1200,
      height: 800
    })

    graph = new LGraph()
    canvas = new LGraphCanvas(canvasElement, graph, { skip_render: true })
    canvas.ctx = createMockCtx(canvasElement)
    canvas.bgctx = createMockCtx(canvas.bgcanvas)

    for (let i = 0; i < 6; i++) {
      addWidgetInputNode(graph, 20 + i * 220, 20)
    }

    useSettingStore().settingValues['Comfy.Graph.CanvasInfo'] = false
    useCanvasStore().canvas = canvas
  })

  afterEach(() => {
    LiteGraph.vueNodesMode = previousVueNodesMode
  })

  it('draws the foreground once per progress event and never the background', async () => {
    const scope = effectScope()
    scope.run(() => useLitegraphSettings())
    await nextTick()
    await drawUntilNoLongerDirty(canvas)

    const foreground = vi.spyOn(canvas, 'drawFrontCanvas')
    const background = vi.spyOn(canvas, 'drawBackCanvas')
    const nodes = graph.nodes

    for (let i = 0; i < PROGRESS_EVENTS; i++) {
      const executingNode = nodes[i % nodes.length]
      executingNode.progress = (i % 10) / 10
      canvas.setDirty(true)
      canvas.draw()
      await nextTick()
    }

    scope.stop()

    expect(foreground).toHaveBeenCalledTimes(PROGRESS_EVENTS)
    expect(background).not.toHaveBeenCalled()
  })

  it('does not treat slot positions written during rendering as a redraw trigger', async () => {
    const scope = effectScope()
    scope.run(() => useLitegraphSettings())
    await nextTick()
    await drawUntilNoLongerDirty(canvas)

    const foreground = vi.spyOn(canvas, 'drawFrontCanvas')
    const background = vi.spyOn(canvas, 'drawBackCanvas')

    for (const node of graph.nodes) {
      const [x, y] = node.inputs[0].pos ?? [0, 0]
      node.inputs[0].pos = [x, y + 1]
    }
    await nextTick()

    scope.stop()

    expect(foreground).not.toHaveBeenCalled()
    expect(background).not.toHaveBeenCalled()
  })

  it('redraws immediately when the CanvasInfo setting changes', async () => {
    const scope = effectScope()
    scope.run(() => useLitegraphSettings())
    await nextTick()
    await drawUntilNoLongerDirty(canvas)

    const foreground = vi.spyOn(canvas, 'drawFrontCanvas')
    const background = vi.spyOn(canvas, 'drawBackCanvas')

    useSettingStore().settingValues['Comfy.Graph.CanvasInfo'] = true
    await nextTick()

    scope.stop()

    expect(canvas.show_info).toBe(true)
    expect(background).toHaveBeenCalledTimes(1)
    expect(foreground).toHaveBeenCalledTimes(1)
  })
})
