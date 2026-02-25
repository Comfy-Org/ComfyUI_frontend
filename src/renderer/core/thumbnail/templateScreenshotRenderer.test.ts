import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { renderMinimapToCanvas } from '@/renderer/extensions/minimap/minimapCanvasRenderer'

import { createTemplateScreenshot } from './templateScreenshotRenderer'

vi.mock('@/renderer/extensions/minimap/minimapCanvasRenderer', () => ({
  renderMinimapToCanvas: vi.fn()
}))

const fakeBlob = new Blob(['fake'], { type: 'image/png' })

function stubCanvas() {
  const clearRect = vi.fn()
  const ctx = { clearRect } as unknown as CanvasRenderingContext2D

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as never
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    function (this: HTMLCanvasElement, cb, _type?, _quality?) {
      cb(fakeBlob)
    }
  )

  return { ctx, clearRect }
}

function makeGraph(nodeCount: number): LGraph {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    pos: [i * 300, i * 200] as [number, number],
    size: [200, 100] as [number, number]
  }))
  return { _nodes: nodes } as unknown as LGraph
}

describe('createTemplateScreenshot', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('returns null for an empty graph', async () => {
    const graph = { _nodes: [] } as unknown as LGraph
    const result = await createTemplateScreenshot(graph)
    expect(result).toBeNull()
  })

  it('returns null when _nodes is undefined', async () => {
    const graph = {} as unknown as LGraph
    const result = await createTemplateScreenshot(graph)
    expect(result).toBeNull()
  })

  it('renders a graph and returns a Blob', async () => {
    stubCanvas()
    const graph = makeGraph(3)

    const blob = await createTemplateScreenshot(graph)

    expect(renderMinimapToCanvas).toHaveBeenCalledOnce()
    expect(blob).toBe(fakeBlob)
  })

  it('uses default 1920x1080 dimensions', async () => {
    stubCanvas()
    const graph = makeGraph(2)

    await createTemplateScreenshot(graph)

    const call = vi.mocked(renderMinimapToCanvas).mock.calls[0]
    const context = call[2]
    expect(context.width).toBe(1920)
    expect(context.height).toBe(1080)
  })

  it('respects custom dimensions', async () => {
    stubCanvas()
    const graph = makeGraph(2)

    await createTemplateScreenshot(graph, { width: 800, height: 600 })

    const context = vi.mocked(renderMinimapToCanvas).mock.calls[0][2]
    expect(context.width).toBe(800)
    expect(context.height).toBe(600)
  })

  it('enables groups, links, and node colors by default', async () => {
    stubCanvas()
    const graph = makeGraph(2)

    await createTemplateScreenshot(graph)

    const { settings } = vi.mocked(renderMinimapToCanvas).mock.calls[0][2]
    expect(settings.showGroups).toBe(true)
    expect(settings.showLinks).toBe(true)
    expect(settings.nodeColors).toBe(true)
  })

  it('passes showGroups and showLinks overrides', async () => {
    stubCanvas()
    const graph = makeGraph(2)

    await createTemplateScreenshot(graph, {
      showGroups: false,
      showLinks: false,
      nodeColors: false
    })

    const { settings } = vi.mocked(renderMinimapToCanvas).mock.calls[0][2]
    expect(settings.showGroups).toBe(false)
    expect(settings.showLinks).toBe(false)
    expect(settings.nodeColors).toBe(false)
  })

  it('cleans up canvas after rendering', async () => {
    const { clearRect } = stubCanvas()
    const graph = makeGraph(2)

    await createTemplateScreenshot(graph)

    expect(clearRect).toHaveBeenCalledWith(0, 0, 1920, 1080)
  })

  it('returns null when toBlob yields null', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn()
    } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function (this: HTMLCanvasElement, cb) {
        cb(null)
      }
    )
    const graph = makeGraph(2)

    const result = await createTemplateScreenshot(graph)

    expect(result).toBeNull()
  })
})
