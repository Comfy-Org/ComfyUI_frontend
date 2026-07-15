import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'

const mocks = vi.hoisted(() => ({
  canvas: null as unknown,
  currentGraph: null as LGraph | null
}))

vi.mock('@/scripts/app', () => ({
  app: {
    get canvas() {
      return mocks.canvas
    }
  }
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    get currentGraph() {
      return mocks.currentGraph
    }
  })
}))

import {
  TOUR_FOCUS_DURATION_MS,
  TOUR_ZOOM_FILL,
  canvasTransformValid,
  coachMarkPosition,
  focusNodes,
  maskRectsFor,
  nodeClientRect,
  nodesPresent
} from './canvasSpotlightAdapter'

function fakeCanvas(options: {
  offset?: [number, number]
  scale?: number
  clientLeft?: number
  clientTop?: number
}) {
  const { offset = [0, 0], scale = 1, clientLeft = 0, clientTop = 0 } = options
  return {
    canvas: {
      getBoundingClientRect: () =>
        ({ left: clientLeft, top: clientTop }) as DOMRect
    },
    ds: { offset, scale }
  }
}

function fakeNode(
  id: number,
  boundingRect: [number, number, number, number]
): LGraphNode {
  return fromAny<LGraphNode, unknown>({ id: toNodeId(id), boundingRect })
}

describe('canvasSpotlightAdapter', () => {
  beforeEach(() => {
    mocks.canvas = fakeCanvas({})
    mocks.currentGraph = null
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('nodeClientRect', () => {
    it('maps graph coords to client coords at scale 1, no offset', () => {
      mocks.canvas = fakeCanvas({ clientLeft: 100, clientTop: 50 })
      const node = fakeNode(1, [10, 20, 200, 80])

      expect(nodeClientRect(node)).toEqual({
        left: 110,
        top: 70,
        width: 200,
        height: 80
      })
    })

    it('applies pan offset and zoom scale', () => {
      mocks.canvas = fakeCanvas({
        clientLeft: 0,
        clientTop: 0,
        offset: [5, 10],
        scale: 2
      })
      const node = fakeNode(1, [10, 20, 100, 40])

      // left = 0 + (10 + 5) * 2 = 30; top = (20 + 10) * 2 = 60; size scaled ×2
      expect(nodeClientRect(node)).toEqual({
        left: 30,
        top: 60,
        width: 200,
        height: 80
      })
    })

    it('returns null when the canvas is unavailable', () => {
      mocks.canvas = null
      expect(nodeClientRect(fakeNode(1, [0, 0, 10, 10]))).toBeNull()
    })
  })

  describe('maskRectsFor', () => {
    it('resolves node ids through the current graph, hugging each node box', () => {
      const node = fakeNode(7, [0, 0, 100, 50])
      mocks.currentGraph = fromPartial<LGraph>({
        getNodeById: (id: NodeId) => (id === toNodeId(7) ? node : null)
      })

      const rects = maskRectsFor([toNodeId(7)])

      expect(rects).toHaveLength(1)
      expect(rects[0]).toEqual({ left: 0, top: 0, width: 100, height: 50 })
    })

    it('drops ids that do not resolve, never throwing', () => {
      mocks.currentGraph = fromPartial<LGraph>({ getNodeById: () => null })

      expect(maskRectsFor([toNodeId(99)])).toEqual([])
    })

    it('drops ids that resolve to undefined without reading boundingRect', () => {
      // getNodeById returns undefined (not null) for ids absent from the graph —
      // e.g. a nested executing node — which must not crash on `.boundingRect`.
      mocks.currentGraph = fromPartial<LGraph>({
        getNodeById: () => undefined as unknown as null
      })

      expect(() => maskRectsFor([toNodeId(99)])).not.toThrow()
      expect(maskRectsFor([toNodeId(99)])).toEqual([])
    })

    it('returns empty when there is no current graph', () => {
      mocks.currentGraph = null
      expect(maskRectsFor([toNodeId(1)])).toEqual([])
    })
  })

  describe('focusNodes', () => {
    it('animates the view to the resolved nodes bounds at the default fill zoom', () => {
      const animate = vi.fn()
      const node = fakeNode(3, [0, 0, 100, 100])
      mocks.canvas = { ...fakeCanvas({}), animateToBounds: animate }
      mocks.currentGraph = fromPartial<LGraph>({
        getNodeById: (id: NodeId) => (id === toNodeId(3) ? node : null)
      })

      focusNodes([toNodeId(3)])

      // createBounds pads the [0,0,100,100] node by 10 on every side.
      expect(animate).toHaveBeenCalledWith([-10, -10, 120, 120], {
        zoom: TOUR_ZOOM_FILL,
        duration: TOUR_FOCUS_DURATION_MS
      })
    })

    it('pans without re-zooming when zoom is 0', () => {
      const animate = vi.fn()
      const node = fakeNode(3, [0, 0, 100, 100])
      mocks.canvas = { ...fakeCanvas({}), animateToBounds: animate }
      mocks.currentGraph = fromPartial<LGraph>({
        getNodeById: (id: NodeId) => (id === toNodeId(3) ? node : null)
      })

      focusNodes([toNodeId(3)], 0)

      expect(animate).toHaveBeenCalledWith([-10, -10, 120, 120], {
        zoom: 0,
        duration: TOUR_FOCUS_DURATION_MS
      })
    })

    it('does nothing when no nodes resolve', () => {
      const animate = vi.fn()
      mocks.canvas = { ...fakeCanvas({}), animateToBounds: animate }
      mocks.currentGraph = fromPartial<LGraph>({ getNodeById: () => null })

      focusNodes([toNodeId(99)])

      expect(animate).not.toHaveBeenCalled()
    })
  })

  describe('nodesPresent', () => {
    it('is true only when every id resolves on the current graph', () => {
      const node = fakeNode(7, [0, 0, 10, 10])
      mocks.currentGraph = fromPartial<LGraph>({
        getNodeById: (id: NodeId) => (id === toNodeId(7) ? node : null)
      })

      expect(nodesPresent([toNodeId(7)])).toBe(true)
      expect(nodesPresent([toNodeId(7), toNodeId(8)])).toBe(false)
    })

    it('is false when there is no current graph', () => {
      mocks.currentGraph = null
      expect(nodesPresent([toNodeId(1)])).toBe(false)
    })
  })

  describe('coachMarkPosition', () => {
    const bubble = { width: 320, height: 200 }
    const viewport = { width: 1440, height: 900 }

    it('centers below the target with room on all sides', () => {
      const target = { left: 600, top: 300, width: 100, height: 60 }

      // left = 600 + 50 - 160 = 490; top = 300 + 60 + 40 = 400
      expect(coachMarkPosition(target, bubble, viewport)).toEqual({
        left: 490,
        top: 400,
        pointerEdge: 'top'
      })
    })

    it('flips above when it would overflow the bottom edge', () => {
      const target = { left: 600, top: 800, width: 100, height: 60 }

      // below (900) + 200 overflows 900; flip above: 800 - 200 - 40 = 560
      expect(coachMarkPosition(target, bubble, viewport).top).toBe(560)
    })

    it('places to the right when below/above would clip the left edge', () => {
      const target = { left: 0, top: 300, width: 40, height: 40 }

      // centered-below/above overflow the left edge; the right placement fits.
      // The card sits to the right, so the cursor points off its left edge.
      expect(coachMarkPosition(target, bubble, viewport)).toEqual({
        left: 0 + 40 + 40,
        top: 300 + 20 - 100,
        pointerEdge: 'left'
      })
    })

    it('places to the left when the right edge has no room', () => {
      const target = { left: 1400, top: 300, width: 40, height: 40 }

      // right placement would overflow; the left placement fits.
      expect(coachMarkPosition(target, bubble, viewport)).toEqual({
        left: 1400 - 320 - 40,
        top: 300 + 20 - 100,
        pointerEdge: 'right'
      })
    })

    it('sits beside a zoomed-in node instead of covering it', () => {
      // A node tall enough that below/above clip vertically but a side still fits
      // (the realistic zoomed case) — the card must not overlap the node.
      const target = { left: 500, top: 60, width: 400, height: 780 }
      const pos = coachMarkPosition(target, bubble, viewport)

      const overlapsTarget =
        pos.left < target.left + target.width &&
        pos.left + bubble.width > target.left &&
        pos.top < target.top + target.height &&
        pos.top + bubble.height > target.top
      expect(overlapsTarget).toBe(false)
    })

    it('clamps to the padded corner when the bubble is larger than the viewport', () => {
      // Bubble bigger than the viewport: no candidate can fit, so the fallback
      // clamps to the top-left padding and points its top edge at the target.
      const tiny = { width: 300, height: 180 }
      const target = { left: 100, top: 80, width: 40, height: 40 }

      // Every clamp max collapses to VIEWPORT_PADDING (viewport - bubble < 0).
      expect(coachMarkPosition(target, bubble, tiny)).toEqual({
        left: 12,
        top: 12,
        pointerEdge: 'top'
      })
    })
  })

  describe('canvasTransformValid', () => {
    it('is true for a finite positive transform', () => {
      mocks.canvas = fakeCanvas({ scale: 1, offset: [0, 0] })
      expect(canvasTransformValid()).toBe(true)
    })

    it('is false when the canvas is absent', () => {
      mocks.canvas = null
      expect(canvasTransformValid()).toBe(false)
    })

    it('is false for a zero or non-finite scale', () => {
      mocks.canvas = fakeCanvas({ scale: 0 })
      expect(canvasTransformValid()).toBe(false)

      mocks.canvas = fakeCanvas({ scale: Number.NaN })
      expect(canvasTransformValid()).toBe(false)
    })

    it('is false for a non-finite offset', () => {
      mocks.canvas = fakeCanvas({ offset: [Number.NaN, 0] })
      expect(canvasTransformValid()).toBe(false)
    })
  })
})
