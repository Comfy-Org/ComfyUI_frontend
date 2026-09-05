import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Document } from './engine/document'
import { registerBuiltinKinds } from './engine/kinds'
import { defaultMode } from './engine/mode'
import type { GroupData, SceneNode } from './engine/node'
import {
  buildPsd,
  leafPlacedBounds,
  makeGuid,
  maskToPlacedCanvas,
  rasterizeLeafPlaced,
  transformCorners
} from './psdExport'
import type { PsdExportDeps } from './psdExport'

function fakeCanvas(w = 8, h = 8): HTMLCanvasElement {
  return {
    width: w,
    height: h,
    tag: Math.random()
  } as unknown as HTMLCanvasElement
}

let idSeq = 0

function base(kind: string, over: Record<string, unknown> = {}): SceneNode {
  return {
    id: `n${++idSeq}`,
    kind,
    name: kind,
    visible: true,
    opacity: 1,
    mode: defaultMode('normal'),
    transform: { x: 0, y: 0, w: 10, h: 10, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    ...over
  } as SceneNode
}

function raster(over: Record<string, unknown> = {}): SceneNode {
  return base('raster', {
    contentId: 'c1',
    naturalWidth: 10,
    naturalHeight: 10,
    ...over
  })
}

function group(
  children: SceneNode[],
  over: Record<string, unknown> = {}
): GroupData {
  return base('group', { children, passThrough: false, ...over }) as GroupData
}

function doc(children: SceneNode[]): Document {
  return {
    version: 2,
    width: 64,
    height: 32,
    root: group(children, { id: 'root' }),
    channels: []
  }
}

function deps(over: Partial<PsdExportDeps> = {}): PsdExportDeps {
  return {
    rasterizeLeaf: () => ({ canvas: fakeCanvas(), left: 0, top: 0 }),
    maskCanvas: () => ({ canvas: fakeCanvas(), left: 0, top: 0 }),
    composite: () => fakeCanvas(),
    ...over
  }
}

describe('buildPsd basics', () => {
  it('builds document with composite and leaf layers', async () => {
    const composite = fakeCanvas()
    const leafCanvas = fakeCanvas(20, 10)
    const d = doc([
      raster({ name: 'Photo', opacity: 0.5, mode: defaultMode('multiply') })
    ])
    const psd = await buildPsd(
      d,
      deps({
        composite: () => composite,
        rasterizeLeaf: () => ({ canvas: leafCanvas, left: 5, top: 7 })
      })
    )

    expect(psd.width).toBe(64)
    expect(psd.height).toBe(32)
    expect(psd.canvas).toBe(composite)
    const layer = psd.children![0]
    expect(layer.name).toBe('Photo')
    expect(layer.opacity).toBe(0.5)
    expect(layer.blendMode).toBe('multiply')
    expect(layer.canvas).toBe(leafCanvas)
    expect(layer.left).toBe(5)
    expect(layer.top).toBe(7)
    expect(layer.right).toBe(25)
    expect(layer.bottom).toBe(17)
  })

  it('keeps layer bounds that extend beyond the canvas', async () => {
    const leafCanvas = fakeCanvas(64, 64)
    const d = doc([raster({ name: 'Overflow' })])
    const psd = await buildPsd(
      d,
      deps({
        rasterizeLeaf: () => ({ canvas: leafCanvas, left: 96, top: -10 })
      })
    )
    const layer = psd.children![0]
    expect(layer.left).toBe(96)
    expect(layer.top).toBe(-10)
    expect(layer.right).toBe(160)
    expect(layer.bottom).toBe(54)
  })

  it('marks invisible layers hidden and clamps opacity', async () => {
    const d = doc([raster({ visible: false, opacity: 3 })])
    const layer = (await buildPsd(d, deps())).children![0]
    expect(layer.hidden).toBe(true)
    expect(layer.opacity).toBe(1)
  })

  it('recurses into groups and maps pass-through', async () => {
    const d = doc([
      group([raster({ name: 'Inner' })], { name: 'Folder', passThrough: true })
    ])
    const layer = (await buildPsd(d, deps())).children![0]
    expect(layer.blendMode).toBe('pass through')
    expect(layer.opened).toBe(true)
    expect(layer.canvas).toBeUndefined()
    expect(layer.children![0].name).toBe('Inner')
  })

  it('omits the mask when no mask canvas is available', async () => {
    const masked = raster({
      mask: { id: 'm1', role: 'mask', contentId: 'mc', enabled: true }
    })
    const layer = (
      await buildPsd(doc([masked]), deps({ maskCanvas: () => null }))
    ).children![0]
    expect(layer.mask).toBeUndefined()
  })

  it('attaches masks with enabled state and placed bounds', async () => {
    const maskCanvas = fakeCanvas(20, 10)
    const masked = raster({
      mask: { id: 'm1', role: 'mask', contentId: 'mc', enabled: false }
    })
    const layer = (
      await buildPsd(
        doc([masked]),
        deps({
          maskCanvas: () => ({ canvas: maskCanvas, left: 3, top: 4 })
        })
      )
    ).children![0]
    expect(layer.mask).toMatchObject({
      canvas: maskCanvas,
      disabled: true,
      defaultColor: 0,
      left: 3,
      top: 4,
      right: 23,
      bottom: 14
    })
  })
})

describe('buildPsd rich layers', () => {
  it('writes parametric fill layers', async () => {
    const fill = base('fill', { fill: { type: 'solid', color: '#123456' } })
    const layer = (await buildPsd(doc([fill]), deps())).children![0]
    expect(layer.vectorFill).toEqual({
      type: 'color',
      color: { r: 18, g: 52, b: 86 }
    })
    expect(layer.vectorStroke).toBeUndefined()
  })

  it('embeds smart objects for raster layers', async () => {
    const source = fakeCanvas(40, 20)
    const png = new Uint8Array([1, 2, 3])
    const node = raster({
      name: 'Photo',
      transform: { x: 10, y: 10, w: 20, h: 10, rotation: 0 }
    })
    const psd = await buildPsd(
      doc([node]),
      deps({
        contentCanvas: () => source,
        canvasPng: async () => png
      })
    )
    const layer = psd.children![0]
    expect(psd.linkedFiles).toHaveLength(1)
    expect(psd.linkedFiles![0].data).toBe(png)
    expect(psd.linkedFiles![0].id).toMatch(
      /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/
    )
    expect(layer.placedLayer).toMatchObject({
      id: psd.linkedFiles![0].id,
      type: 'raster',
      width: 40,
      height: 20
    })
    expect(layer.placedLayer!.transform).toEqual([
      10, 10, 30, 10, 30, 20, 10, 20
    ])
  })

  it('skips smart object when png encoding fails', async () => {
    const psd = await buildPsd(
      doc([raster()]),
      deps({
        contentCanvas: () => fakeCanvas(),
        canvasPng: async () => {
          throw new Error('encode failed')
        }
      })
    )
    expect(psd.children![0].placedLayer).toBeUndefined()
    expect(psd.linkedFiles).toBeUndefined()
  })

  it('skips smart object when content is unavailable', async () => {
    const psd = await buildPsd(
      doc([raster()]),
      deps({
        contentCanvas: () => null,
        canvasPng: async () => new Uint8Array()
      })
    )
    expect(psd.children![0].placedLayer).toBeUndefined()
    expect(psd.linkedFiles).toBeUndefined()
  })
})

describe('guides', () => {
  it('writes guides into image resources', async () => {
    const psd = await buildPsd(
      doc([raster()]),
      deps({
        guides: { horizontal: [16], vertical: [21, 42] }
      })
    )
    expect(psd.imageResources!.gridAndGuidesInformation!.guides).toEqual([
      { location: 16, direction: 'horizontal' },
      { location: 21, direction: 'vertical' },
      { location: 42, direction: 'vertical' }
    ])
  })
})

describe('placed leaf rasterization', () => {
  const origGetContext = HTMLCanvasElement.prototype.getContext

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string
    ) {
      if (kind !== '2d') return null
      const noop = () => {}
      return {
        canvas: this,
        fillStyle: '',
        fillRect: noop,
        translate: noop,
        rotate: noop,
        drawImage: noop,
        clearRect: noop,
        save: noop,
        restore: noop
      } as unknown as CanvasRenderingContext2D
    } as typeof HTMLCanvasElement.prototype.getContext
  })

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext
  })

  function realCanvas(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }

  it('returns null when rendering an unknown node kind', () => {
    const node = base('bogus-kind')
    expect(
      rasterizeLeafPlaced(node, doc([]), { get: () => undefined })
    ).toBeNull()
  })

  it('rasterizes a fill bottom layer across the full document', () => {
    registerBuiltinKinds()
    const fill = base('fill', {
      fill: { type: 'solid', color: '#00df1e' },
      transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 }
    })
    const placed = rasterizeLeafPlaced(fill, doc([fill]), {
      get: () => undefined
    })
    expect(placed).toBeTruthy()
    expect(placed!.left).toBe(0)
    expect(placed!.top).toBe(0)
    expect(placed!.canvas.width).toBe(64)
    expect(placed!.canvas.height).toBe(32)
  })

  it('places mask content into a document-space canvas', () => {
    const masked = raster({
      mask: { id: 'm1', role: 'mask', contentId: 'mc', enabled: true },
      transform: { x: 2, y: 3, w: 10, h: 8, rotation: 0 }
    })
    const entry = {
      id: 'mc',
      canvas: realCanvas(4, 4),
      width: 4,
      height: 4,
      uploadedUrl: null
    }
    const placed = maskToPlacedCanvas(masked, doc([]), {
      get: (id) => (id === 'mc' ? entry : undefined)
    })
    expect(placed).toBeTruthy()
    expect(placed!.left).toBe(2)
    expect(placed!.top).toBe(3)
    expect(placed!.canvas.width).toBe(10)
    expect(placed!.canvas.height).toBe(8)
  })

  it('falls back to document bounds for zero-size transforms', () => {
    const masked = raster({
      mask: { id: 'm1', role: 'mask', contentId: 'mc', enabled: true },
      transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 }
    })
    const entry = {
      id: 'mc',
      canvas: realCanvas(4, 4),
      width: 4,
      height: 4,
      uploadedUrl: null
    }
    const placed = maskToPlacedCanvas(masked, doc([]), { get: () => entry })
    expect(placed!.canvas.width).toBe(64)
    expect(placed!.canvas.height).toBe(32)
  })

  it('returns null without a mask or its content', () => {
    expect(
      maskToPlacedCanvas(raster(), doc([]), { get: () => undefined })
    ).toBeNull()
    const masked = raster({
      mask: { id: 'm1', role: 'mask', contentId: 'mc', enabled: true }
    })
    expect(
      maskToPlacedCanvas(masked, doc([]), { get: () => undefined })
    ).toBeNull()
  })
})

describe('helpers', () => {
  it('generates guid format', () => {
    expect(makeGuid()).toMatch(/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/)
  })

  it('uses secure random values when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0)
        return bytes
      }
    })

    expect(makeGuid()).toBe('00000000-0000-4000-8000-000000000000')
  })

  it('computes placed bounds for plain and rotated transforms', () => {
    const d = doc([])
    expect(
      leafPlacedBounds({ x: 96, y: -10, w: 64, h: 32, rotation: 0 }, d)
    ).toEqual({ x: 96, y: -10, w: 64, h: 32 })
    const rotated = leafPlacedBounds(
      { x: 0, y: 0, w: 10, h: 10, rotation: Math.PI / 4 },
      d
    )
    expect(rotated.w).toBeGreaterThan(13)
    expect(rotated.x).toBeLessThan(0)
    expect(
      leafPlacedBounds({ x: 5, y: 5, w: 0, h: 0, rotation: 0 }, d)
    ).toEqual({ x: 0, y: 0, w: 64, h: 32 })
  })

  it('computes rotated corners', () => {
    const corners = transformCorners({
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      rotation: Math.PI / 2
    })
    expect(corners[0]).toBeCloseTo(10, 5)
    expect(corners[1]).toBeCloseTo(0, 5)
    expect(corners[6]).toBeCloseTo(0, 5)
    expect(corners[7]).toBeCloseTo(0, 5)
  })
})
