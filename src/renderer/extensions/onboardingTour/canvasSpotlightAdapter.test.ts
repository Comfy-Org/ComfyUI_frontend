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
  fitToBounds,
  maskRectsFor,
  nodeClientRect,
  portClientPos
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
    it('resolves node ids through the current graph and pads each rect', () => {
      const node = fakeNode(7, [0, 0, 100, 50])
      mocks.currentGraph = fromPartial<LGraph>({
        getNodeById: (id: NodeId) => (id === toNodeId(7) ? node : null)
      })

      const rects = maskRectsFor([toNodeId(7)])

      expect(rects).toHaveLength(1)
      // rect padded outward by 10 on every side
      expect(rects[0]).toEqual({ left: -10, top: -10, width: 120, height: 70 })
    })

    it('drops ids that do not resolve, never throwing', () => {
      mocks.currentGraph = fromPartial<LGraph>({ getNodeById: () => null })

      expect(maskRectsFor([toNodeId(99)])).toEqual([])
    })

    it('returns empty when there is no current graph', () => {
      mocks.currentGraph = null
      expect(maskRectsFor([toNodeId(1)])).toEqual([])
    })
  })

  describe('portClientPos', () => {
    it('maps an input slot position to client coords', () => {
      mocks.canvas = fakeCanvas({ clientLeft: 4, clientTop: 8, scale: 1 })
      const node = fromAny<LGraphNode, unknown>({
        getInputPos: () => [30, 40]
      })

      expect(portClientPos(node, 0, true)).toEqual([34, 48])
    })

    it('maps an output slot position to client coords', () => {
      mocks.canvas = fakeCanvas({ clientLeft: 0, clientTop: 0, scale: 2 })
      const node = fromAny<LGraphNode, unknown>({
        getOutputPos: () => [10, 20]
      })

      expect(portClientPos(node, 0, false)).toEqual([20, 40])
    })

    it('returns null when the canvas is unavailable', () => {
      mocks.canvas = null
      const node = fromAny<LGraphNode, unknown>({ getInputPos: () => [0, 0] })
      expect(portClientPos(node, 0, true)).toBeNull()
    })
  })

  describe('fitToBounds', () => {
    it('fits the view to the resolved nodes bounds', () => {
      const fit = vi.fn()
      const node = fakeNode(3, [0, 0, 100, 100])
      mocks.canvas = {
        ...fakeCanvas({}),
        ds: { ...fakeCanvas({}).ds, fitToBounds: fit }
      }
      mocks.currentGraph = fromPartial<LGraph>({
        getNodeById: (id: NodeId) => (id === toNodeId(3) ? node : null)
      })

      fitToBounds([toNodeId(3)], 0.5)

      // createBounds pads the [0,0,100,100] node by 10 on every side.
      expect(fit).toHaveBeenCalledWith([-10, -10, 120, 120], { zoom: 0.5 })
    })

    it('does nothing when no nodes resolve', () => {
      const fit = vi.fn()
      mocks.canvas = {
        ...fakeCanvas({}),
        ds: { ...fakeCanvas({}).ds, fitToBounds: fit }
      }
      mocks.currentGraph = fromPartial<LGraph>({ getNodeById: () => null })

      fitToBounds([toNodeId(99)], 0.5)

      expect(fit).not.toHaveBeenCalled()
    })
  })
})
