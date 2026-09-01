import { beforeAll, describe, expect, it } from 'vitest'

import type { RasterData } from '../node'
import { fillBitmap, fillKind } from './fill'
import { groupKind } from './group'
import { registerBuiltinKinds } from './index'
import { rasterKind } from './raster'

beforeAll(() => registerBuiltinKinds())

function stubContext2d(
  extra: Partial<CanvasRenderingContext2D> = {}
): typeof HTMLCanvasElement.prototype.getContext {
  return function (this: HTMLCanvasElement, kind: string) {
    if (kind !== '2d') return null
    return {
      canvas: this,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      drawImage: () => {},
      ...extra
    } as unknown as CanvasRenderingContext2D
  } as typeof HTMLCanvasElement.prototype.getContext
}

describe('rasterKind', () => {
  it('contentIds includes the mask content', () => {
    const node: RasterData = rasterKind.create({
      contentId: 'pix',
      mask: { id: 'm', role: 'mask', contentId: 'maskpix', enabled: true }
    })
    expect(rasterKind.contentIds(node).sort()).toEqual(['maskpix', 'pix'])
  })

  it('hitTest respects the transform box', () => {
    const node = rasterKind.create({
      transform: { x: 10, y: 10, w: 20, h: 20, rotation: 0 }
    })
    expect(rasterKind.hitTest!(node, { x: 15, y: 15 })).toBe(true)
    expect(rasterKind.hitTest!(node, { x: 5, y: 5 })).toBe(false)
  })

  it('has no transform-commit hook: scale/rotate stay metadata (non-destructive)', () => {
    expect(rasterKind.onTransformCommitted).toBeUndefined()
  })
})

describe('fillKind', () => {
  it('create defaults to solid gray with a zero transform (canvas-wide, immovable)', () => {
    const node = fillKind.create()
    expect(node.fill).toEqual({ type: 'solid', color: '#808080' })
    expect(node.transform).toEqual({ x: 0, y: 0, w: 0, h: 0, rotation: 0 })
    expect(fillKind.bbox(node)).toEqual({ x: 0, y: 0, w: 0, h: 0 })
    expect(fillKind.hitTest!(node, { x: 1, y: 1 })).toBe(false)
  })

  it('contentIds only lists the mask', () => {
    const node = fillKind.create({
      mask: { id: 'm', role: 'mask', contentId: 'maskpix', enabled: true }
    })
    expect(fillKind.contentIds(node)).toEqual(['maskpix'])
  })

  it('fillBitmap caches per node and re-renders when the spec or size changes', () => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = stubContext2d({
      fillStyle: '',
      fillRect: () => {}
    })
    try {
      const node = fillKind.create({
        fill: { type: 'solid', color: '#ffffff' }
      })
      const first = fillBitmap(node, 10, 10)
      expect(first).not.toBeNull()
      expect(fillBitmap(node, 10, 10)).toBe(first)
      node.fill = { type: 'solid', color: '#ff0000' }
      const recolored = fillBitmap(node, 10, 10)
      expect(recolored).not.toBe(first)
      expect(fillBitmap(node, 20, 10)).not.toBe(recolored)
    } finally {
      HTMLCanvasElement.prototype.getContext = orig
    }
  })
})

describe('groupKind', () => {
  it('contentIds recurses into children', () => {
    const g = groupKind.create({
      children: [
        rasterKind.create({ contentId: 'a' }),
        rasterKind.create({ contentId: 'b' })
      ]
    })
    expect(groupKind.contentIds(g).sort()).toEqual(['a', 'b'])
  })

  it('bbox is the union of child boxes', () => {
    const g = groupKind.create({
      children: [
        rasterKind.create({
          transform: { x: 0, y: 0, w: 10, h: 10, rotation: 0 }
        }),
        rasterKind.create({
          transform: { x: 20, y: 20, w: 10, h: 10, rotation: 0 }
        })
      ]
    })
    expect(groupKind.bbox(g)).toEqual({ x: 0, y: 0, w: 30, h: 30 })
    expect(groupKind.bbox(groupKind.create())).toEqual({
      x: 0,
      y: 0,
      w: 0,
      h: 0
    })
  })

  it('renderNode is handled by the compositor, not the kind', () => {
    const ctx = {} as unknown as Parameters<typeof groupKind.renderNode>[1]
    expect(groupKind.renderNode(groupKind.create(), ctx)).toBeNull()
  })
})
