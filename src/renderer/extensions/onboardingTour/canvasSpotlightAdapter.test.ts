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
  INITIAL_SETTLE,
  TOUR_FOCUS_DURATION_MS,
  canvasTransformValid,
  coachMarkPosition,
  focusFillFor,
  focusNodes,
  maskRectsFor,
  nodeClientRect,
  nodesPresent,
  rectIntersectsViewport,
  trackSettle
} from './canvasSpotlightAdapter'
import type { ScreenRect } from './canvasSpotlightAdapter'

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
    it('pans to the resolved nodes bounds without re-zooming when no room is reserved', () => {
      const animate = vi.fn()
      const node = fakeNode(3, [0, 0, 100, 100])
      mocks.canvas = { ...fakeCanvas({}), animateToBounds: animate }
      mocks.currentGraph = fromPartial<LGraph>({
        getNodeById: (id: NodeId) => (id === toNodeId(3) ? node : null)
      })

      focusNodes([toNodeId(3)])

      // createBounds pads the [0,0,100,100] node by 10 on every side; zoom 0 keeps
      // the current scale, so later steps pan rather than re-zoom.
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

  describe('rectIntersectsViewport', () => {
    const viewport = { left: 0, top: 100, width: 1000, height: 800 }

    it.each([
      ['fully inside', { left: 200, top: 200, width: 50, height: 50 }, true],
      [
        'straddling an edge',
        { left: -20, top: 200, width: 50, height: 50 },
        true
      ],
      [
        'above the region',
        { left: 200, top: 10, width: 50, height: 50 },
        false
      ],
      [
        'past the right',
        { left: 1000, top: 200, width: 50, height: 50 },
        false
      ],
      [
        'below the region',
        { left: 200, top: 900, width: 50, height: 50 },
        false
      ]
    ])('is %s => %s', (_label, rect, expected) => {
      expect(rectIntersectsViewport(rect, viewport)).toBe(expected)
    })

    it('respects the region origin, not the window', () => {
      // Sits under a 100px top bar: inside the window, outside the canvas region.
      const underTopBar = { left: 200, top: 20, width: 50, height: 50 }
      expect(rectIntersectsViewport(underTopBar, viewport)).toBe(false)
    })
  })

  describe('trackSettle', () => {
    const feed = (keys: (string | null)[]) =>
      keys.reduce((state, key) => trackSettle(state, key), INITIAL_SETTLE)

    it('does not settle while the transform keeps changing', () => {
      // A camera mid-tween reports a new transform every frame.
      expect(feed(['a', 'b', 'c', 'd']).settled).toBe(false)
    })

    it('settles once the transform holds still for two frames', () => {
      expect(feed(['a', 'a']).settled).toBe(false)
      expect(feed(['a', 'a', 'a']).settled).toBe(true)
    })

    it('un-settles when the user grabs the canvas after it landed', () => {
      const landed = feed(['a', 'a', 'a'])
      expect(landed.settled).toBe(true)
      expect(trackSettle(landed, 'b').settled).toBe(false)
    })

    it('treats an absent transform as settled — there is no camera to wait for', () => {
      expect(trackSettle(INITIAL_SETTLE, null).settled).toBe(true)
    })

    it('does not settle on a tween that pauses on one value for a single frame', () => {
      // Two overlapping tweens can repeat a rounded value for one frame; requiring
      // two consecutive matches keeps that from reading as a landing.
      expect(feed(['a', 'b', 'b', 'c']).settled).toBe(false)
    })
  })

  describe('focusFillFor', () => {
    const viewport = { left: 0, top: 0, width: 1500, height: 900 }
    const reserve = { width: 360, height: 300 }

    /** Litegraph's own fit (DragAndScale), so we assert the scale it will land on. */
    const scaleFor = (
      fill: number,
      bounds: { width: number; height: number }
    ) =>
      Math.min(
        (fill * viewport.width) / Math.max(bounds.width, 300),
        (fill * viewport.height) / Math.max(bounds.height, 300),
        10
      )

    it('caps a tiny node at the same scale a roomy one gets, never zooming further', () => {
      // Both fit with room to spare, so both land on the ceiling rather than one
      // being magnified until it dominates the view.
      const tiny = { width: 60, height: 40 }
      const roomy = { width: 400, height: 300 }

      const tinyScale = scaleFor(focusFillFor(tiny, viewport, reserve), tiny)
      const roomyScale = scaleFor(focusFillFor(roomy, viewport, reserve), roomy)

      expect(tinyScale).toBeCloseTo(roomyScale, 2)
      // And the cap holds the node near life size, not blown up.
      expect(tinyScale).toBeLessThanOrEqual(1.2)
    })

    it('shrinks a tall node until the mark still has room beside it', () => {
      const tall = { width: 400, height: 1600 }
      const scale = scaleFor(focusFillFor(tall, viewport, reserve), tall)

      expect(scale).toBeLessThan(1)
      // The node leaves a full mark's width of the region free.
      expect(tall.width * scale).toBeLessThanOrEqual(
        viewport.width - reserve.width
      )
      expect(tall.height * scale).toBeLessThanOrEqual(viewport.height)
    })

    it('keeps a wide node on screen by stacking the mark below it', () => {
      const wide = { width: 2400, height: 300 }
      const scale = scaleFor(focusFillFor(wide, viewport, reserve), wide)

      expect(wide.width * scale).toBeLessThanOrEqual(viewport.width)
      expect(wide.height * scale).toBeLessThanOrEqual(
        viewport.height - reserve.height
      )
    })

    it('leaves the mark room for any node, without a floor forcing overflow', () => {
      // The regression: a minimum scale used to override the fit, pushing a big
      // node past the viewport so no placement could sit clear of it.
      const nodes = [
        { width: 240, height: 140 },
        { width: 500, height: 650 },
        { width: 600, height: 1100 },
        { width: 800, height: 1600 },
        { width: 3000, height: 2400 }
      ]

      for (const node of nodes) {
        const scale = scaleFor(focusFillFor(node, viewport, reserve), node)
        const fitsBeside =
          node.width * scale <= viewport.width - reserve.width &&
          node.height * scale <= viewport.height
        const fitsBelow =
          node.width * scale <= viewport.width &&
          node.height * scale <= viewport.height - reserve.height
        expect(fitsBeside || fitsBelow).toBe(true)
      }
    })

    it('adapts to the region it is given, not a fixed screen size', () => {
      const node = { width: 500, height: 400 }
      const small = { left: 0, top: 0, width: 800, height: 600 }
      const large = { left: 0, top: 0, width: 2560, height: 1400 }

      const smallScale =
        (focusFillFor(node, small, reserve) * small.width) /
        Math.max(node.width, 300)
      const largeScale =
        (focusFillFor(node, large, reserve) * large.width) /
        Math.max(node.width, 300)

      expect(smallScale).toBeLessThan(largeScale)
    })
  })

  describe('coachMarkPosition', () => {
    const bubble = { width: 320, height: 200 }
    const viewport = { left: 0, top: 0, width: 1440, height: 900 }

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
      // Bubble bigger than the viewport: no candidate fits, so the fallback pins
      // it on screen and points from the side with the most room (here, right).
      const tiny = { left: 0, top: 0, width: 300, height: 180 }
      const target = { left: 100, top: 80, width: 40, height: 40 }

      // Every clamp max collapses to VIEWPORT_PADDING (viewport - bubble < 0).
      expect(coachMarkPosition(target, bubble, tiny)).toEqual({
        left: 12,
        top: 12,
        pointerEdge: 'left'
      })
    })

    /** Whether a placement sits entirely inside the region. */
    const isInside = (
      pos: { left: number; top: number },
      box: { width: number; height: number },
      region: ScreenRect
    ) =>
      pos.left >= region.left &&
      pos.top >= region.top &&
      pos.left + box.width <= region.left + region.width &&
      pos.top + box.height <= region.top + region.height

    describe('staying inside an inset region', () => {
      // The canvas sits below the top bar and beside the panels, so the mark must
      // be placed against that region — measuring the whole window put it under
      // the toolbar.
      const inset = { left: 64, top: 100, width: 1200, height: 700 }

      it('never lands under the chrome above the region', () => {
        const target = { left: 400, top: 120, width: 80, height: 60 }
        const pos = coachMarkPosition(target, bubble, inset)
        expect(pos.top).toBeGreaterThanOrEqual(inset.top)
      })

      it.each([
        [
          'taller than the region',
          { left: 400, top: 110, width: 200, height: 900 }
        ],
        [
          'wider than the region',
          { left: 70, top: 300, width: 1400, height: 200 }
        ],
        [
          'larger on both axes',
          { left: 70, top: 110, width: 1400, height: 900 }
        ],
        [
          'hard against the top-left',
          { left: 64, top: 100, width: 40, height: 40 }
        ],
        [
          'hard against the bottom-right',
          { left: 1200, top: 750, width: 60, height: 45 }
        ]
      ])('keeps the mark on screen with a target %s', (_label, target) => {
        expect(
          isInside(coachMarkPosition(target, bubble, inset), bubble, inset)
        ).toBe(true)
      })
    })

    describe('preferred edge', () => {
      const target = { left: 600, top: 300, width: 100, height: 60 }

      it('holds the preferred side while it still fits', () => {
        // Below fits and would win on its own; the caller's latched side wins.
        expect(
          coachMarkPosition(target, bubble, viewport, 'left').pointerEdge
        ).toBe('left')
      })

      it('abandons the preferred side once it stops fitting', () => {
        // Nothing fits to the right of a target hard against the right edge.
        const atRightEdge = { left: 1380, top: 300, width: 50, height: 60 }
        expect(
          coachMarkPosition(atRightEdge, bubble, viewport, 'left').pointerEdge
        ).not.toBe('left')
      })

      it('falls back to first-fit when no side is preferred', () => {
        expect(coachMarkPosition(target, bubble, viewport).pointerEdge).toBe(
          'top'
        )
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
