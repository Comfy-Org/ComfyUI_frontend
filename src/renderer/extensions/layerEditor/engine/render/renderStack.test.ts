import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type {
  Compositor,
  CompositeInput,
  FBOHandle,
  NodeTexture
} from '../compositor'
import { DefaultContentStore } from '../impl/contentStore'
import { defaultMode } from '../mode'
import type { Document } from '../document'
import type { GroupData, Rect, SceneNode, Transform } from '../node'
import type { NodeKind } from '../nodeKind'
import { registerNodeKind } from '../nodeKind'
import type { PlacedEntry, PreviewOverride, RenderDeps } from './renderStack'
import { buildDocumentInputs, renderDocument } from './renderStack'

const T: Transform = { x: 0, y: 0, w: 10, h: 10, rotation: 0 }
const LOCKS = { content: false, position: false, visibility: false }

const stubKind = {
  kind: 'stub',
  renderNode: (_node: unknown, ctx: { region: unknown }) => ({
    source: document.createElement('canvas'),
    rect: ctx.region,
    linear: false
  })
} as unknown as NodeKind

beforeAll(() => registerNodeKind(stubKind))

function leaf(opacity = 1, visible = true): SceneNode {
  return {
    kind: 'stub',
    id: `l${opacity}`,
    name: 'l',
    visible,
    opacity,
    mode: defaultMode('normal'),
    transform: { ...T },
    locks: { ...LOCKS }
  } as unknown as SceneNode
}

function group(
  children: SceneNode[],
  opts: Partial<GroupData> = {}
): GroupData {
  return {
    kind: 'group',
    id: 'g',
    name: 'g',
    visible: true,
    opacity: 1,
    mode: defaultMode('normal'),
    transform: { ...T },
    locks: { ...LOCKS },
    children,
    passThrough: false,
    ...opts
  }
}

function doc(children: SceneNode[]): Document {
  return {
    version: 2,
    width: 100,
    height: 100,
    root: group(children),
    channels: []
  }
}

class FakeCompositor implements Compositor {
  composites: Array<{
    inputs: CompositeInput[]
    target: FBOHandle | null
    region: Rect | null
  }> = []
  allocated: FBOHandle[] = []
  freed: number[] = []
  private nextId = 1
  init() {
    return true
  }
  resize() {}
  composite(
    inputs: CompositeInput[],
    target?: FBOHandle | null,
    region?: Rect
  ) {
    this.composites.push({
      inputs: [...inputs],
      target: target ?? null,
      region: region ?? null
    })
  }
  allocTarget(width: number, height: number): FBOHandle {
    const h = { id: this.nextId++, width, height }
    this.allocated.push(h)
    return h
  }
  freeTarget(handle: FBOHandle) {
    this.freed.push(handle.id)
  }
  targetTexture(): WebGLTexture {
    return {} as WebGLTexture
  }
  upload(): WebGLTexture {
    return {} as WebGLTexture
  }
  readback(): ImageData {
    return new ImageData(1, 1)
  }
  async toBlob(): Promise<Blob> {
    return new Blob()
  }
  getCanvas() {
    return null
  }
  dispose() {}
}

function deps(compositor: Compositor): RenderDeps {
  return { content: new DefaultContentStore(), compositor }
}

describe('renderDocument', () => {
  it('composites visible layers bottom→top, skipping invisible / transparent', () => {
    const c = new FakeCompositor()
    renderDocument(
      doc([leaf(0.5), leaf(1, false), leaf(0), leaf(0.8)]),
      deps(c)
    )
    expect(c.composites).toHaveLength(1)
    const { inputs, target } = c.composites[0]
    expect(target).toBeNull()
    expect(inputs.map((i) => i.opacity)).toEqual([0.5, 0.8])
  })

  it('renders a non-pass-through group into an isolated target, then blends it up', () => {
    const c = new FakeCompositor()
    const g = group([leaf(1), leaf(1)], { id: 'grp', opacity: 0.7 })
    renderDocument(doc([leaf(1), g]), deps(c))

    expect(c.composites).toHaveLength(2)
    expect(c.composites[0].inputs).toHaveLength(2)
    expect(c.composites[0].target).not.toBeNull()
    expect(c.composites[1].target).toBeNull()
    expect(c.composites[1].inputs.map((i) => i.opacity)).toEqual([1, 0.7])

    expect(c.allocated).toHaveLength(1)
    expect(c.freed).toEqual([c.allocated[0].id])
  })

  it('frees the group target even when the final composite throws', () => {
    class ExplodingCompositor extends FakeCompositor {
      override composite(
        inputs: CompositeInput[],
        target?: FBOHandle | null,
        region?: Rect
      ) {
        if (!target) throw new Error('boom')
        super.composite(inputs, target, region)
      }
    }
    const c = new ExplodingCompositor()
    const g = group([leaf(1)], { id: 'grp' })
    expect(() => renderDocument(doc([leaf(1), g]), deps(c))).toThrow('boom')
    expect(c.allocated).toHaveLength(1)
    expect(c.freed).toEqual([c.allocated[0].id])
  })

  it('frees every allocated target when a group composite throws mid-build', () => {
    class ExplodingCompositor extends FakeCompositor {
      targetComposites = 0
      override composite(
        inputs: CompositeInput[],
        target?: FBOHandle | null,
        region?: Rect
      ) {
        if (target && ++this.targetComposites === 2) throw new Error('boom')
        super.composite(inputs, target, region)
      }
    }
    const c = new ExplodingCompositor()
    const first = group([leaf(1)], { id: 'g1' })
    const second = group([leaf(0.9)], { id: 'g2' })
    expect(() => renderDocument(doc([first, second]), deps(c))).toThrow('boom')
    expect(c.allocated).toHaveLength(2)
    expect([...c.freed].sort()).toEqual(c.allocated.map((h) => h.id).sort())
  })

  it('frees nested targets when a later allocTarget throws', () => {
    class RationedCompositor extends FakeCompositor {
      allocs = 0
      override allocTarget(width: number, height: number): FBOHandle {
        if (++this.allocs === 2) throw new Error('out of targets')
        return super.allocTarget(width, height)
      }
    }
    const c = new RationedCompositor()
    const inner = group([leaf(1)], { id: 'inner' })
    const outer = group([inner], { id: 'outer' })
    expect(() => renderDocument(doc([outer]), deps(c))).toThrow(
      'out of targets'
    )
    expect(c.allocated).toHaveLength(1)
    expect(c.freed).toEqual([c.allocated[0].id])
  })

  it('splices a pass-through group directly into the parent stack (no isolation target)', () => {
    const c = new FakeCompositor()
    const g = group([leaf(1), leaf(1)], { passThrough: true })
    renderDocument(doc([leaf(1), g]), deps(c))
    expect(c.composites).toHaveLength(1)
    expect(c.composites[0].inputs).toHaveLength(3)
    expect(c.allocated).toHaveLength(0)
  })

  it('forwards the damage region to the main composite only', () => {
    const c = new FakeCompositor()
    const g = group([leaf(1)], { id: 'grp' })
    const region = { x: 5, y: 6, w: 7, h: 8 }
    renderDocument(doc([leaf(1), g]), deps(c), undefined, region)
    expect(c.composites[0].target).not.toBeNull()
    expect(c.composites[0].region).toBeNull()
    expect(c.composites[1].target).toBeNull()
    expect(c.composites[1].region).toEqual(region)
  })
})

describe('mask channels and buildDocumentInputs', () => {
  let restoreGetContext: (() => void) | null = null

  beforeAll(() => {
    const proto = HTMLCanvasElement.prototype as { getContext: unknown }
    const original = proto.getContext
    proto.getContext = () => ({
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      drawImage() {},
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low'
    })
    restoreGetContext = () => {
      proto.getContext = original
    }
  })

  afterAll(() => restoreGetContext?.())

  function maskCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas')
    cv.width = 10
    cv.height = 10
    return cv
  }

  function withMask(node: SceneNode, contentId: string, enabled = true) {
    return {
      ...node,
      mask: { id: 'm', role: 'mask' as const, contentId, enabled }
    } as SceneNode
  }

  it('attaches an enabled mask as a linear texture on the layer input', () => {
    const c = new FakeCompositor()
    const d = deps(c)
    const mid = d.content.register(maskCanvas())
    renderDocument(doc([withMask(leaf(1), mid)]), d)
    const input = c.composites[0].inputs[0] as { mask?: NodeTexture }
    expect(input.mask).toBeDefined()
    expect(input.mask!.linear).toBe(true)
  })

  it('ignores disabled masks and masks with missing content', () => {
    const c = new FakeCompositor()
    const d = deps(c)
    const mid = d.content.register(maskCanvas())
    renderDocument(
      doc([withMask(leaf(1), mid, false), withMask(leaf(0.5), 'missing')]),
      d
    )
    const inputs = c.composites[0].inputs as Array<{ mask?: NodeTexture }>
    expect(inputs[0].mask).toBeUndefined()
    expect(inputs[1].mask).toBeUndefined()
  })

  it('masks an isolated group result', () => {
    const c = new FakeCompositor()
    const d = deps(c)
    const mid = d.content.register(maskCanvas())
    const g = withMask(group([leaf(1)], { id: 'grp' }), mid)
    renderDocument(doc([g]), d)
    const groupInput = c.composites[1].inputs[0] as { mask?: NodeTexture }
    expect(groupInput.mask).toBeDefined()
  })

  it('buildDocumentInputs defers target cleanup to the caller', () => {
    const c = new FakeCompositor()
    const g = group([leaf(1)], { id: 'grp' })
    const built = buildDocumentInputs(doc([g]), deps(c))
    expect(built.inputs).toHaveLength(1)
    expect(c.allocated).toHaveLength(1)
    expect(c.freed).toEqual([])
    built.cleanup()
    expect(c.freed).toEqual([c.allocated[0].id])
  })
})

describe('paint preview overrides (incremental placed cache)', () => {
  let restoreGetContext: (() => void) | null = null

  beforeAll(() => {
    const proto = HTMLCanvasElement.prototype as { getContext: unknown }
    const original = proto.getContext
    const stub = {
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      drawImage() {},
      beginPath() {},
      rect() {},
      clip() {},
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low'
    }
    proto.getContext = () => stub
    restoreGetContext = () => {
      proto.getContext = original
    }
  })

  afterAll(() => restoreGetContext?.())

  function previewDeps(
    c: Compositor,
    overrides: Map<string, PreviewOverride>,
    placedCache: Map<string, PlacedEntry>
  ): RenderDeps {
    return {
      content: new DefaultContentStore(),
      compositor: c,
      overrides,
      placedCache
    }
  }

  function previewCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas')
    cv.width = 10
    cv.height = 10
    return cv
  }

  it('reuses the placed canvas and versions the texture across renders', () => {
    const c = new FakeCompositor()
    const overrides = new Map<string, PreviewOverride>()
    const placedCache = new Map<string, PlacedEntry>()
    const node = leaf(1)
    const cv = previewCanvas()
    overrides.set(`content:${node.id}`, { canvas: cv, version: 1, rects: null })

    const d = previewDeps(c, overrides, placedCache)
    renderDocument(doc([node]), d)
    const t1 = (c.composites[0].inputs[0] as { texture: NodeTexture }).texture
    expect(t1.key).toBe(`preview:content:${node.id}`)
    expect(t1.version).toBe(1)

    renderDocument(doc([node]), d)
    const t2 = (c.composites[1].inputs[0] as { texture: NodeTexture }).texture
    expect(t2.version).toBe(1)
    expect(t2.source).toBe(t1.source)
    expect(t2.dirtyRects).toBeUndefined()
  })

  it('a version bump with a rect flows through as dirtyRect for partial upload', () => {
    const c = new FakeCompositor()
    const overrides = new Map<string, PreviewOverride>()
    const placedCache = new Map<string, PlacedEntry>()
    const node = leaf(1)
    const cv = previewCanvas()
    const d = previewDeps(c, overrides, placedCache)

    overrides.set(`content:${node.id}`, { canvas: cv, version: 1, rects: null })
    renderDocument(doc([node]), d)
    overrides.set(`content:${node.id}`, {
      canvas: cv,
      version: 2,
      rects: [{ x: 1, y: 2, w: 3, h: 4 }]
    })
    renderDocument(doc([node]), d)

    const t2 = (c.composites[1].inputs[0] as { texture: NodeTexture }).texture
    expect(t2.version).toBe(2)
    expect(t2.dirtyRects).toEqual([{ x: 1, y: 2, w: 3, h: 4 }])
    expect(t2.source).toBe(
      (c.composites[0].inputs[0] as { texture: NodeTexture }).texture.source
    )
  })

  it('a skipped version falls back to a full redraw (no dirtyRect)', () => {
    const c = new FakeCompositor()
    const overrides = new Map<string, PreviewOverride>()
    const placedCache = new Map<string, PlacedEntry>()
    const node = leaf(1)
    const cv = previewCanvas()
    const d = previewDeps(c, overrides, placedCache)

    overrides.set(`content:${node.id}`, { canvas: cv, version: 1, rects: null })
    renderDocument(doc([node]), d)
    overrides.set(`content:${node.id}`, {
      canvas: cv,
      version: 3,
      rects: [{ x: 1, y: 2, w: 3, h: 4 }]
    })
    renderDocument(doc([node]), d)

    const t2 = (c.composites[1].inputs[0] as { texture: NodeTexture }).texture
    expect(t2.version).toBe(3)
    expect(t2.dirtyRects).toBeUndefined()
  })

  it('drops the preview cache entry once the override is gone', () => {
    const c = new FakeCompositor()
    const overrides = new Map<string, PreviewOverride>()
    const placedCache = new Map<string, PlacedEntry>()
    const node = leaf(1)
    const d = previewDeps(c, overrides, placedCache)

    overrides.set(`content:${node.id}`, {
      canvas: previewCanvas(),
      version: 1,
      rects: null
    })
    renderDocument(doc([node]), d)
    expect(placedCache.has(`preview:content:${node.id}`)).toBe(true)

    overrides.delete(`content:${node.id}`)
    renderDocument(doc([node]), d)
    expect(placedCache.has(`preview:content:${node.id}`)).toBe(false)
  })
})
