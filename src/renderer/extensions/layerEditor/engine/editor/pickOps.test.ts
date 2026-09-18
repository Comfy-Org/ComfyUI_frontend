import { describe, expect, it } from 'vitest'

import type { ContentStore } from '../content'
import { defaultMode } from '../mode'
import type { FillData, GroupData, RasterData } from '../node'
import { PICK_OPACITY_THRESHOLD, layerOpacityAt, pickLayerAt } from './pickOps'

function mkRaster(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  contentId = id
): RasterData {
  return {
    id,
    kind: 'raster',
    name: id,
    visible: true,
    opacity: 1,
    mode: defaultMode(),
    transform: { x, y, w, h, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    contentId,
    naturalWidth: w,
    naturalHeight: h
  }
}

function mkFill(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number
): FillData {
  return {
    id,
    kind: 'fill',
    name: id,
    visible: true,
    opacity: 1,
    mode: defaultMode(),
    transform: { x, y, w, h, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    fill: { type: 'solid', color: '#808080' }
  }
}

function fakeContent(
  canvases: Partial<Record<string, HTMLCanvasElement>>
): Pick<ContentStore, 'get'> {
  return {
    get: (id: string) => {
      const canvas = canvases[id]
      return canvas
        ? {
            id,
            canvas,
            width: canvas.width,
            height: canvas.height,
            uploadedUrl: null
          }
        : undefined
    }
  }
}

function fakeCanvas(
  w: number,
  h: number,
  alphaAt: (x: number, y: number) => number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  Object.defineProperty(canvas, 'getContext', {
    configurable: true,
    value: () => ({
      getImageData: (x: number, y: number) => ({
        data: new Uint8ClampedArray([0, 0, 0, Math.round(alphaAt(x, y) * 255)])
      })
    })
  })
  return canvas
}

describe('layerOpacityAt', () => {
  it('samples raster alpha in layer-local pixel space', () => {
    const canvas = fakeCanvas(100, 100, (x) => (x < 50 ? 0 : 1))
    const node = mkRaster('a', 10, 10, 200, 200)
    const content = fakeContent({ a: canvas })
    expect(layerOpacityAt(node, { x: 20, y: 100 }, content)).toBe(0)
    expect(layerOpacityAt(node, { x: 200, y: 100 }, content)).toBe(1)
  })
  it('scales a group pick by the group opacity', () => {
    const child = mkRaster('a', 0, 0, 100, 100)
    const content = fakeContent({ a: fakeCanvas(10, 10, () => 1) })
    const group: GroupData = {
      id: 'g',
      kind: 'group',
      name: 'g',
      visible: true,
      opacity: 0.2,
      mode: defaultMode(),
      transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
      locks: { content: false, position: false, visibility: false },
      children: [child],
      passThrough: false
    }
    expect(layerOpacityAt(group, { x: 50, y: 50 }, content)).toBeCloseTo(0.2)
    expect(pickLayerAt([group], { x: 50, y: 50 }, content)).toBeNull()
  })
  it('returns 0 outside the transform and for invisible layers', () => {
    const node = mkRaster('a', 0, 0, 100, 100)
    const content = fakeContent({ a: fakeCanvas(10, 10, () => 1) })
    expect(layerOpacityAt(node, { x: 500, y: 50 }, content)).toBe(0)
    expect(
      layerOpacityAt({ ...node, visible: false }, { x: 50, y: 50 }, content)
    ).toBe(0)
  })
  it('maps through rotation', () => {
    const canvas = fakeCanvas(100, 100, (x) => (x < 50 ? 0 : 1))
    const node = mkRaster('a', 0, 0, 100, 100)
    node.transform.rotation = Math.PI
    const content = fakeContent({ a: canvas })
    expect(layerOpacityAt(node, { x: 25, y: 50 }, content)).toBe(1)
    expect(layerOpacityAt(node, { x: 75, y: 50 }, content)).toBe(0)
  })
  it('falls back to opaque when content is missing', () => {
    const node = mkRaster('a', 0, 0, 100, 100)
    expect(layerOpacityAt(node, { x: 50, y: 50 }, fakeContent({}))).toBe(1)
  })
  it('fill layers use their box', () => {
    const content = fakeContent({})
    expect(
      layerOpacityAt(mkFill('f', 0, 0, 100, 40), { x: 50, y: 20 }, content)
    ).toBe(1)
    expect(
      layerOpacityAt(mkFill('f', 0, 0, 100, 40), { x: 50, y: 90 }, content)
    ).toBe(0)
  })
  it('groups take the max over children', () => {
    const canvas = fakeCanvas(100, 100, () => 0.5)
    const group: GroupData = {
      id: 'g',
      kind: 'group',
      name: 'g',
      visible: true,
      opacity: 1,
      mode: defaultMode(),
      transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
      locks: { content: false, position: false, visibility: false },
      children: [mkRaster('a', 0, 0, 100, 100)],
      passThrough: false
    }
    expect(
      layerOpacityAt(group, { x: 50, y: 50 }, fakeContent({ a: canvas }))
    ).toBeCloseTo(0.5, 2)
  })
})

describe('pickLayerAt — GIMP pick semantics', () => {
  it('clicks fall through transparent pixels to the layer below', () => {
    const below = mkRaster('below', 0, 0, 100, 100)
    const above = mkRaster('above', 0, 0, 100, 100)
    const content = fakeContent({
      below: fakeCanvas(100, 100, () => 1),
      above: fakeCanvas(100, 100, (x) => (x < 50 ? 0 : 1))
    })
    expect(pickLayerAt([below, above], { x: 25, y: 50 }, content)?.id).toBe(
      'below'
    )
    expect(pickLayerAt([below, above], { x: 75, y: 50 }, content)?.id).toBe(
      'above'
    )
  })
  it('honors the 25% opacity threshold', () => {
    const below = mkRaster('below', 0, 0, 100, 100)
    const above = mkRaster('above', 0, 0, 100, 100)
    const content = fakeContent({
      below: fakeCanvas(100, 100, () => 1),
      above: fakeCanvas(100, 100, () => 0.2)
    })
    expect(pickLayerAt([below, above], { x: 50, y: 50 }, content)?.id).toBe(
      'below'
    )
    const content2 = fakeContent({
      below: fakeCanvas(100, 100, () => 1),
      above: fakeCanvas(100, 100, () => 0.3)
    })
    expect(pickLayerAt([below, above], { x: 50, y: 50 }, content2)?.id).toBe(
      'above'
    )
    expect(PICK_OPACITY_THRESHOLD).toBe(0.25)
  })
  it('skips invisible layers and returns null on empty space', () => {
    const a = mkRaster('a', 0, 0, 100, 100)
    a.visible = false
    const content = fakeContent({ a: fakeCanvas(100, 100, () => 1) })
    expect(pickLayerAt([a], { x: 50, y: 50 }, content)).toBeNull()
    expect(pickLayerAt([], { x: 50, y: 50 }, content)).toBeNull()
  })
})
