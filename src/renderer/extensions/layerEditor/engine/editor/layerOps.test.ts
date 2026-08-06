import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { History } from '../history'
import { DefaultContentStore } from '../impl/contentStore'
import { rasterKind } from '../kinds/raster'
import { defaultMode, resolveMode } from '../mode'
import type { GroupData, RasterData, SceneNode } from '../node'
import type { LayerOpDeps } from './layerOps'
import {
  alphaBBox,
  compositePair,
  cropToContent,
  layerToCanvasSize,
  mergeDown
} from './layerOps'

class FakeImageData {
  readonly data: Uint8ClampedArray
  constructor(
    readonly width: number,
    readonly height: number
  ) {
    this.data = new Uint8ClampedArray(width * height * 4)
  }
}

let imageDataProvider: ((w: number, h: number) => FakeImageData) | null = null

function make2dStub(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  return {
    canvas,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    fillStyle: '',
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    drawImage: () => {},
    fillRect: () => {},
    putImageData: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) =>
      imageDataProvider?.(w, h) ?? new FakeImageData(w, h),
    createImageData: (w: number, h: number) => new FakeImageData(w, h)
  } as unknown as CanvasRenderingContext2D
}

const origGetContext = HTMLCanvasElement.prototype.getContext

beforeEach(() => {
  imageDataProvider = null
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    kind: string
  ) {
    return kind === '2d' ? make2dStub(this) : null
  } as typeof HTMLCanvasElement.prototype.getContext
})

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = origGetContext
})

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function root(children: SceneNode[]): GroupData {
  return {
    kind: 'group',
    id: 'root',
    name: 'root',
    visible: true,
    opacity: 1,
    mode: defaultMode('normal'),
    transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    children,
    passThrough: false
  }
}

describe('alphaBBox', () => {
  it('finds the opaque content bounds', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4)
    const set = (x: number, y: number) => (data[(y * 4 + x) * 4 + 3] = 255)
    set(1, 1)
    set(2, 3)
    expect(alphaBBox(data, 4, 4)).toEqual({ x: 1, y: 1, w: 2, h: 3 })
  })

  it('returns null for a fully transparent buffer', () => {
    expect(alphaBBox(new Uint8ClampedArray(4 * 4 * 4), 4, 4)).toBeNull()
  })
})

describe('compositePair', () => {
  it('normal/normal fast path composites straight alpha in linear light', () => {
    const bottom = Uint8ClampedArray.of(255, 0, 0, 255)
    const top = Uint8ClampedArray.of(0, 0, 255, 128)
    const out = compositePair(
      {
        data: bottom,
        mask: null,
        mode: resolveMode(defaultMode('normal')),
        opacity: 1
      },
      {
        data: top,
        mask: null,
        mode: resolveMode(defaultMode('normal')),
        opacity: 1
      },
      1
    )
    expect(out[3]).toBe(255)
    expect(out[2]).toBeGreaterThan(100)
    expect(out[0]).toBeGreaterThan(100)
  })

  it('top mask gates the top layer contribution', () => {
    const bottom = Uint8ClampedArray.of(255, 0, 0, 255)
    const top = Uint8ClampedArray.of(0, 0, 255, 255)
    const out = compositePair(
      {
        data: bottom,
        mask: null,
        mode: resolveMode(defaultMode('normal')),
        opacity: 1
      },
      {
        data: top,
        mask: Uint8ClampedArray.of(0, 0, 0, 255),
        mode: resolveMode(defaultMode('normal')),
        opacity: 1
      },
      1
    )
    expect(out[0]).toBe(255)
    expect(out[2]).toBe(0)
  })

  it('multiply over transparent stays transparent (clip-to-backdrop)', () => {
    const bottom = Uint8ClampedArray.of(0, 0, 0, 0)
    const top = Uint8ClampedArray.of(128, 128, 128, 255)
    const out = compositePair(
      {
        data: bottom,
        mask: null,
        mode: resolveMode(defaultMode('normal')),
        opacity: 1
      },
      {
        data: top,
        mask: null,
        mode: resolveMode(defaultMode('multiply')),
        opacity: 1
      },
      1
    )
    expect(out[3]).toBe(0)
  })
})

describe('mergeDown (structure)', () => {
  function setup() {
    const content = new DefaultContentStore()
    const history = new History()
    const a = rasterKind.create({
      name: 'bottom',
      contentId: content.register(canvasOf(40, 40)),
      naturalWidth: 40,
      naturalHeight: 40,
      opacity: 0.5,
      mode: defaultMode('multiply'),
      transform: { x: 0, y: 0, w: 40, h: 40, rotation: 0 }
    })
    const b = rasterKind.create({
      name: 'top',
      contentId: content.register(canvasOf(30, 30)),
      naturalWidth: 30,
      naturalHeight: 30,
      transform: { x: 20, y: 20, w: 30, h: 30, rotation: 0 }
    })
    const tree = root([a, b])
    const deps: LayerOpDeps = {
      root: tree,
      content,
      push: (cmd) => history.push(cmd),
      bitmapOf: (node) =>
        content.get((node as RasterData).contentId)?.canvas ?? null
    }
    return { deps, history, tree, a, b }
  }

  it('merges the union bounds into the bottom layer and removes the top', () => {
    const { deps, tree, a, b } = setup()
    expect(mergeDown(deps, b.id)).toBe(true)
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toBe(a)
    expect(a.naturalWidth).toBe(50)
    expect(a.naturalHeight).toBe(50)
    expect(a.transform).toMatchObject({ x: 0, y: 0, w: 50, h: 50, rotation: 0 })
    expect(a.opacity).toBe(1)
    expect(a.mode.blend).toBe('normal')
  })

  it('is one undo step restoring both layers and the bottom state', () => {
    const { deps, history, tree, a, b } = setup()
    const beforeId = a.contentId
    mergeDown(deps, b.id)
    history.undo()
    expect(tree.children).toHaveLength(2)
    expect(tree.children[1]).toBe(b)
    expect(a.contentId).toBe(beforeId)
    expect(a.opacity).toBe(0.5)
    expect(a.mode.blend).toBe('multiply')
    expect(a.naturalWidth).toBe(40)
  })

  it('refuses when there is no visible raster below', () => {
    const { deps, tree, a, b } = setup()
    a.visible = false
    expect(mergeDown(deps, b.id)).toBe(false)
    expect(tree.children).toHaveLength(2)
  })
})

describe('cropToContent', () => {
  function setup(alphaRect: { x: number; y: number; w: number; h: number }) {
    const content = new DefaultContentStore()
    const history = new History()
    imageDataProvider = (w, h) => {
      const img = new FakeImageData(w, h)
      for (let y = alphaRect.y; y < alphaRect.y + alphaRect.h; y++) {
        for (let x = alphaRect.x; x < alphaRect.x + alphaRect.w; x++) {
          img.data[(y * w + x) * 4 + 3] = 255
        }
      }
      return img
    }
    const node = rasterKind.create({
      contentId: content.register(canvasOf(40, 40)),
      url: 'http://x/a.png',
      naturalWidth: 40,
      naturalHeight: 40,
      transform: { x: 0, y: 0, w: 40, h: 40, rotation: 0 }
    })
    const tree = root([node])
    const deps: LayerOpDeps = {
      root: tree,
      content,
      push: (cmd) => history.push(cmd),
      bitmapOf: () => null
    }
    return { deps, history, node }
  }

  it('shrinks the layer to its opaque bounds (undoable)', () => {
    const { deps, history, node } = setup({ x: 10, y: 10, w: 10, h: 10 })
    const beforeId = node.contentId
    expect(cropToContent(deps, node.id)).toBe(true)
    expect(node.contentId).not.toBe(beforeId)
    expect(node.url).toBeUndefined()
    expect(node.naturalWidth).toBe(10)
    expect(node.naturalHeight).toBe(10)
    expect(node.transform).toEqual({ x: 10, y: 10, w: 10, h: 10, rotation: 0 })

    history.undo()
    expect(node.contentId).toBe(beforeId)
    expect(node.naturalWidth).toBe(40)
    expect(node.transform).toEqual({ x: 0, y: 0, w: 40, h: 40, rotation: 0 })
  })

  it('scales the crop offset by the layer transform', () => {
    const { deps, node } = setup({ x: 10, y: 10, w: 10, h: 10 })
    node.transform = { x: 0, y: 0, w: 80, h: 80, rotation: 0 }
    expect(cropToContent(deps, node.id)).toBe(true)
    expect(node.transform).toEqual({ x: 20, y: 20, w: 20, h: 20, rotation: 0 })
  })

  it('refuses full-coverage content and rotated layers', () => {
    const full = setup({ x: 0, y: 0, w: 40, h: 40 })
    expect(cropToContent(full.deps, full.node.id)).toBe(false)

    const rotated = setup({ x: 10, y: 10, w: 10, h: 10 })
    rotated.node.transform.rotation = 0.5
    expect(cropToContent(rotated.deps, rotated.node.id)).toBe(false)
  })

  it('refuses fully transparent content', () => {
    const { deps, node } = setup({ x: 0, y: 0, w: 0, h: 0 })
    expect(cropToContent(deps, node.id)).toBe(false)
  })
})

describe('layerToCanvasSize', () => {
  function setup() {
    const content = new DefaultContentStore()
    const history = new History()
    const node = rasterKind.create({
      contentId: content.register(canvasOf(10, 10)),
      url: 'http://x/a.png',
      naturalWidth: 10,
      naturalHeight: 10,
      transform: { x: 5, y: 5, w: 10, h: 10, rotation: 0 }
    })
    const tree = root([node])
    const deps: LayerOpDeps = {
      root: tree,
      content,
      push: (cmd) => history.push(cmd),
      bitmapOf: () => null
    }
    return { deps, history, node, content }
  }

  it('bakes the placement into a document-sized buffer (undoable)', () => {
    const { deps, history, node } = setup()
    const beforeId = node.contentId
    expect(layerToCanvasSize(deps, node.id, 30, 30)).toBe(true)
    expect(node.contentId).not.toBe(beforeId)
    expect(node.url).toBeUndefined()
    expect(node.naturalWidth).toBe(30)
    expect(node.naturalHeight).toBe(30)
    expect(node.transform).toEqual({ x: 0, y: 0, w: 30, h: 30, rotation: 0 })

    history.undo()
    expect(node.contentId).toBe(beforeId)
    expect(node.transform).toEqual({ x: 5, y: 5, w: 10, h: 10, rotation: 0 })
  })

  it('bakes the mask into the same bounds', () => {
    const { deps, node, content } = setup()
    const mid = content.register(canvasOf(10, 10))
    node.mask = { id: 'm', role: 'mask', contentId: mid, enabled: true }
    expect(layerToCanvasSize(deps, node.id, 30, 30)).toBe(true)
    expect(node.mask.contentId).not.toBe(mid)
    expect(content.get(node.mask.contentId)?.width).toBe(30)
  })

  it('refuses when the layer already fills the canvas', () => {
    const { deps, node } = setup()
    node.naturalWidth = 30
    node.naturalHeight = 30
    node.transform = { x: 0, y: 0, w: 30, h: 30, rotation: 0 }
    expect(layerToCanvasSize(deps, node.id, 30, 30)).toBe(false)
  })
})
