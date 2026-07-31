import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

import {
  CARD_GLIDE_MS,
  CARD_WIDTH,
  CURSOR_GAP
} from '@/platform/onboarding/coachmarkLayout'

import { MAX_FOCUS_SCALE, focusFill, frameNode } from './cameraFraming'

const FOCUS_MS = 450
const VIEWPORT = { width: 1280, height: 720 }

function scaleFor(bounds: ReadOnlyRect, fill: number): number {
  return Math.min(
    (fill * VIEWPORT.width) / Math.max(bounds[2], 300),
    (fill * VIEWPORT.height) / Math.max(bounds[3], 300)
  )
}

const appState = vi.hoisted(() => ({ canvas: undefined as unknown }))
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    get canvas() {
      return appState.canvas
    }
  })
}))

const camera = {
  animateToBounds: vi.fn(),
  setDirty: vi.fn(),
  ds: { fitToBounds: vi.fn(), offset: [0, 0], scale: 1 }
}

let canvasRect = new DOMRect(0, 0, VIEWPORT.width, VIEWPORT.height)

function mountCanvas(): LGraphNode {
  const graph = new LGraph()
  const node = new LGraphNode('node')
  node.pos = [100, 200]
  node.size = [50, 60]
  graph.add(node)
  node.updateArea()
  appState.canvas = {
    ...camera,
    graph,
    canvas: { getBoundingClientRect: () => canvasRect }
  }
  return node
}

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduce }))
  )
}

describe('focusFill', () => {
  it('frames a small node without magnifying it past legibility', () => {
    const bounds: ReadOnlyRect = [0, 0, 120, 80]

    expect(
      scaleFor(bounds, focusFill(bounds, VIEWPORT)),
      'a node blown up to fill the viewport reads as a bug, not a spotlight'
    ).toBeCloseTo(MAX_FOCUS_SCALE)
  })

  it('keeps a wide node clear of the column the card sits in', () => {
    const bounds: ReadOnlyRect = [0, 0, 4000, 200]
    const cardColumn = CARD_WIDTH + CURSOR_GAP * 2

    const framedWidth =
      bounds[2] * scaleFor(bounds, focusFill(bounds, VIEWPORT))
    const freePerSide = (VIEWPORT.width - framedWidth) / 2

    expect(
      freePerSide,
      'the fit centres the node, so half the free width is all the card gets'
    ).toBeGreaterThanOrEqual(cardColumn - 1)
  })

  it('still frames something on a viewport too narrow for the card columns', () => {
    const narrow = { width: CARD_WIDTH + CURSOR_GAP * 2, height: 720 }

    expect(
      focusFill([0, 0, 120, 80], narrow),
      'reserving both columns anyway solves a negative width, and zooms the camera inside out'
    ).toBeGreaterThan(0)
  })
})

describe('frameNode', () => {
  const runningSteps: AbortController[] = []

  /** Framing a step, torn down like the engine does: by aborting its signal. */
  function frameStep(nodeId: NodeId): Promise<void> {
    const controller = new AbortController()
    runningSteps.push(controller)
    return frameNode(nodeId, controller.signal).catch(() => {})
  }

  function endRunningSteps() {
    runningSteps.forEach((controller) => controller.abort())
    runningSteps.length = 0
  }

  beforeEach(() => {
    vi.useFakeTimers()
    setReducedMotion(false)
    canvasRect = new DOMRect(0, 0, VIEWPORT.width, VIEWPORT.height)
  })

  afterEach(() => {
    endRunningSteps()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    camera.animateToBounds.mockClear()
    camera.ds.fitToBounds.mockClear()
    camera.ds.offset = [0, 0]
    camera.ds.scale = 1
    appState.canvas = undefined
  })

  it('skips the flight for a step already framed, as Back lands on', async () => {
    const node = mountCanvas()
    const [x, y, width, height] = node.boundingRect
    const fill = focusFill(node.boundingRect, VIEWPORT)
    const scale = scaleFor(node.boundingRect, fill)
    camera.ds.scale = scale
    camera.ds.offset = [
      VIEWPORT.width / 2 / scale - (x + width / 2),
      VIEWPORT.height / 2 / scale - (y + height / 2)
    ]

    await frameStep(node.id)
    await vi.advanceTimersByTimeAsync(CARD_GLIDE_MS + FOCUS_MS)

    expect(
      camera.animateToBounds,
      'animating a camera already there is 750ms of nothing'
    ).not.toHaveBeenCalled()
  })

  it('still flies for a centred node held at the wrong zoom', async () => {
    const node = mountCanvas()
    const [x, y, width, height] = node.boundingRect
    const scale =
      scaleFor(node.boundingRect, focusFill(node.boundingRect, VIEWPORT)) / 2
    camera.ds.scale = scale
    camera.ds.offset = [
      VIEWPORT.width / 2 / scale - (x + width / 2),
      VIEWPORT.height / 2 / scale - (y + height / 2)
    ]

    void frameStep(node.id)
    await vi.advanceTimersByTimeAsync(CARD_GLIDE_MS)

    expect(
      camera.animateToBounds,
      'centred is not framed: the step still has to zoom in'
    ).toHaveBeenCalled()
  })

  it('still flies when the camera sits somewhere else', async () => {
    const node = mountCanvas()

    void frameStep(node.id)
    await vi.advanceTimersByTimeAsync(CARD_GLIDE_MS)

    expect(camera.animateToBounds).toHaveBeenCalled()
  })

  it('holds the camera until the card has glided to the new step', async () => {
    const node = mountCanvas()
    void frameStep(node.id)

    await vi.advanceTimersByTimeAsync(CARD_GLIDE_MS - 1)
    expect(
      camera.animateToBounds,
      'the camera must not move while the card is still gliding'
    ).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(camera.animateToBounds).toHaveBeenCalledWith(
      node.boundingRect,
      expect.objectContaining({
        duration: FOCUS_MS,
        zoom: expect.any(Number)
      })
    )
  })

  it('frames the opening step at once, having no glide to wait out', async () => {
    const node = mountCanvas()
    const controller = new AbortController()
    runningSteps.push(controller)

    void frameNode(node.id, controller.signal, { glide: false }).catch(() => {})
    await vi.advanceTimersByTimeAsync(0)

    expect(
      camera.animateToBounds,
      'a scrim that lands and then sits still before moving reads as a stall'
    ).toHaveBeenCalled()
  })

  it('resolves only once the camera has landed', async () => {
    const node = mountCanvas()
    let settled = false
    void frameStep(node.id).then(() => (settled = true))

    await vi.advanceTimersByTimeAsync(CARD_GLIDE_MS + FOCUS_MS - 1)
    expect(
      settled,
      'the step reveals its copy on this promise, and copy over a moving view is unreadable'
    ).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)
  })

  it('frames instantly under reduced motion rather than skipping the node', async () => {
    setReducedMotion(true)
    const node = mountCanvas()

    await frameStep(node.id)

    expect(camera.ds.fitToBounds).toHaveBeenCalledWith(
      node.boundingRect,
      expect.objectContaining({ zoom: expect.any(Number) })
    )
    expect(
      camera.animateToBounds,
      'a zero-duration animateToBounds throws'
    ).not.toHaveBeenCalled()
  })

  it('leaves the camera alone when the step ends during the glide', async () => {
    const node = mountCanvas()
    const controller = new AbortController()

    void frameNode(node.id, controller.signal).catch(() => {})
    controller.abort()
    await vi.advanceTimersByTimeAsync(CARD_GLIDE_MS)

    expect(camera.animateToBounds).not.toHaveBeenCalled()
  })

  it('re-solves the fill on resize, since it is a fraction of the viewport', async () => {
    const node = mountCanvas()
    void frameStep(node.id)
    await vi.advanceTimersByTimeAsync(CARD_GLIDE_MS)
    const framedFill = camera.animateToBounds.mock.calls[0]?.[1].zoom

    const resized = { width: 640, height: 480 }
    canvasRect = new DOMRect(0, 0, resized.width, resized.height)
    window.dispatchEvent(new Event('resize'))

    const refitFill = camera.ds.fitToBounds.mock.calls[0]?.[1].zoom
    expect(refitFill).not.toBe(framedFill)
    expect(
      refitFill,
      'a fill kept from the old viewport reserves the wrong room for the card'
    ).toBe(focusFill(node.boundingRect, resized))
  })

  it('leaves the camera alone when a resize collapses the viewport', async () => {
    const node = mountCanvas()
    void frameStep(node.id)
    await vi.advanceTimersByTimeAsync(CARD_GLIDE_MS)

    canvasRect = new DOMRect(0, 0, 640, 0)
    window.dispatchEvent(new Event('resize'))

    expect(
      camera.ds.fitToBounds,
      'dividing by a collapsed height hands the camera a NaN zoom it never recovers from'
    ).not.toHaveBeenCalled()
  })

  it('stops re-fitting once the step ends', async () => {
    const node = mountCanvas()
    const controller = new AbortController()
    void frameNode(node.id, controller.signal).catch(() => {})
    await vi.advanceTimersByTimeAsync(CARD_GLIDE_MS)

    controller.abort()
    window.dispatchEvent(new Event('resize'))

    expect(camera.ds.fitToBounds).not.toHaveBeenCalled()
  })

  it('does nothing for a node the graph no longer holds', async () => {
    mountCanvas()

    await frameStep(toNodeId('missing'))

    expect(camera.animateToBounds).not.toHaveBeenCalled()
  })
})
