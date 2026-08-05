import { beforeAll, describe, expect, it } from 'vitest'

import { canRasterizeLayer, rasterizeLayer } from '../editor/layerOps'
import type { Command } from '../history'
import { DefaultContentStore } from '../impl/contentStore'
import type { GroupData, RasterData } from '../node'
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
  it('create → normalize → serialize round-trips core fields', () => {
    const node = rasterKind.create({
      name: 'A',
      contentId: 'c1',
      naturalWidth: 100,
      naturalHeight: 50
    })
    const norm = rasterKind.normalize(rasterKind.serialize(node))
    expect(norm).toMatchObject({
      kind: 'raster',
      name: 'A',
      contentId: 'c1',
      naturalWidth: 100,
      naturalHeight: 50
    })
    expect(norm.transform).toMatchObject({ w: 100, h: 50 })
  })

  it('clamps opacity and defaults locks on normalize', () => {
    const n = rasterKind.normalize({ kind: 'raster', opacity: 5 })
    expect(n.opacity).toBe(1)
    expect(n.locks).toEqual({
      content: false,
      position: false,
      visibility: false
    })
  })

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

  it('rasterizeLayer bakes scale into a new buffer on demand (undoable)', () => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = stubContext2d()
    try {
      const content = new DefaultContentStore()
      const buf = document.createElement('canvas')
      buf.width = 100
      buf.height = 50
      const cid = content.register(buf, { uploadedUrl: 'http://x/a.png' })
      const node = rasterKind.create({
        contentId: cid,
        url: 'http://x/a.png',
        naturalWidth: 100,
        naturalHeight: 50,
        transform: { x: 10, y: 10, w: 200, h: 100, rotation: 0 }
      })
      const root = groupKind.create({ id: 'root', children: [node] })
      const cmds: Command[] = []
      const deps = {
        root,
        content,
        push: (c: Command) => cmds.push(c),
        bitmapOf: () => null
      }

      expect(canRasterizeLayer(root, node.id)).toBe(true)
      expect(rasterizeLayer(deps, node.id)).toBe(true)
      expect(node.contentId).not.toBe(cid)
      expect(node.url).toBeUndefined()
      expect(node.naturalWidth).toBe(200)
      expect(node.naturalHeight).toBe(100)
      expect(node.transform).toMatchObject({ w: 200, h: 100, rotation: 0 })
      expect(canRasterizeLayer(root, node.id)).toBe(false)

      cmds[0].apply('undo')
      expect(node.contentId).toBe(cid)
      expect(node.url).toBe('http://x/a.png')
      expect(node.naturalWidth).toBe(100)
      expect(node.transform).toMatchObject({ x: 10, y: 10, w: 200, h: 100 })
    } finally {
      HTMLCanvasElement.prototype.getContext = orig
    }
  })

  it('rasterizeLayer grows to the rotated bounding box and clears rotation', () => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = stubContext2d()
    try {
      const content = new DefaultContentStore()
      const buf = document.createElement('canvas')
      buf.width = 100
      buf.height = 100
      const cid = content.register(buf)
      const node = rasterKind.create({
        contentId: cid,
        naturalWidth: 100,
        naturalHeight: 100,
        transform: { x: 0, y: 0, w: 100, h: 100, rotation: Math.PI / 4 }
      })
      const root = groupKind.create({ id: 'root', children: [node] })
      const deps = { root, content, push: () => {}, bitmapOf: () => null }
      expect(rasterizeLayer(deps, node.id)).toBe(true)
      const expected = Math.ceil(100 * Math.SQRT2)
      expect(node.naturalWidth).toBeGreaterThanOrEqual(expected - 1)
      expect(node.naturalWidth).toBeLessThanOrEqual(expected + 2)
      expect(node.transform.rotation).toBe(0)
    } finally {
      HTMLCanvasElement.prototype.getContext = orig
    }
  })

  it('rasterizeLayer refuses identity placements (nothing to bake)', () => {
    const content = new DefaultContentStore()
    const node = rasterKind.create({
      contentId: 'c',
      naturalWidth: 10,
      naturalHeight: 10,
      transform: { x: 40, y: 0, w: 10, h: 10, rotation: 0 }
    })
    const root = groupKind.create({ id: 'root', children: [node] })
    const deps = { root, content, push: () => {}, bitmapOf: () => null }
    expect(canRasterizeLayer(root, node.id)).toBe(false)
    expect(rasterizeLayer(deps, node.id)).toBe(false)
  })

  it('rasterizeLayer bakes the mask alongside the content and undo restores both', () => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = stubContext2d({
      fillStyle: '',
      fillRect: () => {}
    })
    try {
      const content = new DefaultContentStore()
      const buf = document.createElement('canvas')
      buf.width = 50
      buf.height = 50
      const cid = content.register(buf)
      const maskBuf = document.createElement('canvas')
      maskBuf.width = 50
      maskBuf.height = 50
      const mid = content.register(maskBuf, { uploadedUrl: 'http://x/m.png' })
      const node = rasterKind.create({
        contentId: cid,
        naturalWidth: 50,
        naturalHeight: 50,
        transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
        mask: {
          id: 'm',
          role: 'mask',
          contentId: mid,
          url: 'http://x/m.png',
          enabled: true
        }
      })
      const root = groupKind.create({ id: 'root', children: [node] })
      const cmds: Command[] = []
      const deps = {
        root,
        content,
        push: (c: Command) => cmds.push(c),
        bitmapOf: () => null
      }
      expect(rasterizeLayer(deps, node.id)).toBe(true)
      expect(node.mask!.contentId).not.toBe(mid)
      expect(node.mask!.url).toBeUndefined()

      cmds[0].apply('undo')
      expect(node.mask!.contentId).toBe(mid)
      expect(node.mask!.url).toBe('http://x/m.png')
    } finally {
      HTMLCanvasElement.prototype.getContext = orig
    }
  })
})

describe('rasterKind — hydrate and thumbnail', () => {
  function loaderFor(urls: string[]) {
    return async (url: string) => {
      urls.push(url)
      const canvas = document.createElement('canvas')
      canvas.width = 4
      canvas.height = 4
      return canvas
    }
  }

  it('hydrate loads missing content and mask from their urls', async () => {
    const content = new DefaultContentStore()
    const loaded: string[] = []
    const node = rasterKind.create({
      contentId: 'pix',
      url: 'http://x/a.png',
      mask: {
        id: 'm',
        role: 'mask',
        contentId: 'maskpix',
        url: 'http://x/m.png',
        enabled: true
      }
    })
    await rasterKind.hydrate(node, { content, loadUrl: loaderFor(loaded) })
    expect(loaded).toEqual(['http://x/a.png', 'http://x/m.png'])
    expect(content.get('pix')?.uploadedUrl).toBe('http://x/a.png')
    expect(content.has('maskpix')).toBe(true)
  })

  it('hydrate skips content that is already registered', async () => {
    const content = new DefaultContentStore()
    const cid = content.register(document.createElement('canvas'))
    const loaded: string[] = []
    const node = rasterKind.create({ contentId: cid, url: 'http://x/a.png' })
    await rasterKind.hydrate(node, { content, loadUrl: loaderFor(loaded) })
    expect(loaded).toEqual([])
  })

  it('thumbnail returns the content canvas when present', () => {
    const content = new DefaultContentStore()
    const buf = document.createElement('canvas')
    const cid = content.register(buf)
    const node = rasterKind.create({ contentId: cid })
    expect(rasterKind.thumbnail(node, { content, size: 32 })).toBe(buf)
    expect(
      rasterKind.thumbnail(rasterKind.create({ contentId: 'missing' }), {
        content,
        size: 32
      })
    ).toBeNull()
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

  it('serialize → normalize round-trips the spec and re-zeroes the transform', () => {
    const node = fillKind.create({
      fill: {
        type: 'linear',
        angle: 45,
        stops: [
          { offset: 0, color: '#ff0000' },
          { offset: 1, color: '#0000ff' }
        ]
      }
    })
    const raw = fillKind.serialize(node) as Record<string, unknown>
    raw.transform = { x: 9, y: 9, w: 50, h: 50, rotation: 1 }
    const norm = fillKind.normalize(raw)
    expect(norm.fill).toMatchObject({ type: 'linear', angle: 45 })
    expect(norm.transform).toEqual({ x: 0, y: 0, w: 0, h: 0, rotation: 0 })
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
  it('normalizes children recursively through the registry, dropping unknown kinds', () => {
    const g: GroupData = groupKind.normalize({
      kind: 'group',
      children: [
        { kind: 'raster', contentId: 'a' },
        { kind: 'mystery', contentId: 'x' },
        { kind: 'raster', contentId: 'b' }
      ]
    })
    expect(g.children.map((c) => c.kind)).toEqual(['raster', 'raster'])
  })

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

  it('serialize → normalize round-trips nested children', () => {
    const g = groupKind.create({
      name: 'G',
      children: [
        rasterKind.create({ name: 'A', contentId: 'ca' }),
        groupKind.create({
          name: 'Inner',
          children: [rasterKind.create({ name: 'B', contentId: 'cb' })]
        })
      ]
    })
    const norm = groupKind.normalize(groupKind.serialize(g))
    expect(norm.name).toBe('G')
    expect(norm.children.map((c) => c.kind)).toEqual(['raster', 'group'])
    const inner = norm.children[1] as GroupData
    expect(inner.children).toHaveLength(1)
    expect(inner.children[0]).toMatchObject({ kind: 'raster', contentId: 'cb' })
  })

  it('hydrate recurses into children and loads the group mask', async () => {
    const content = new DefaultContentStore()
    const loaded: string[] = []
    const loadUrl = async (url: string) => {
      loaded.push(url)
      return document.createElement('canvas')
    }
    const g = groupKind.create({
      mask: {
        id: 'gm',
        role: 'mask',
        contentId: 'gmask',
        url: 'http://x/gm.png',
        enabled: true
      },
      children: [
        rasterKind.create({ contentId: 'pix', url: 'http://x/child.png' })
      ]
    })
    await groupKind.hydrate(g, { content, loadUrl })
    expect(loaded.sort()).toEqual(['http://x/child.png', 'http://x/gm.png'])
    expect(content.has('gmask')).toBe(true)
    expect(content.has('pix')).toBe(true)
  })

  it('renderNode and thumbnail are handled by the compositor, not the kind', () => {
    const ctx = {} as unknown as Parameters<typeof groupKind.renderNode>[1]
    const deps = {} as unknown as Parameters<typeof groupKind.thumbnail>[1]
    expect(groupKind.renderNode(groupKind.create(), ctx)).toBeNull()
    expect(groupKind.thumbnail(groupKind.create(), deps)).toBeNull()
  })
})
