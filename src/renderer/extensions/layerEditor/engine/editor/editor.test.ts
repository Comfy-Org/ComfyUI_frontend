import { beforeAll, describe, expect, it } from 'vitest'

import type { Compositor, CompositeInput, FBOHandle } from '../compositor'
import { registerBuiltinKinds } from '../kinds'
import { groupKind } from '../kinds/group'
import { rasterKind } from '../kinds/raster'
import type { RasterData } from '../node'
import { defaultControl, registerTool } from '../tool'
import type { ToolContext } from '../tool'
import { registerBuiltinTools } from '../tools'
import { createEditor } from './editor'
import type { Editor } from './editor'
import { OverlayList } from './overlayList'

beforeAll(() => {
  registerBuiltinKinds()
  registerBuiltinTools()
})

class FakeCompositor implements Compositor {
  canvas: HTMLCanvasElement | null = null
  readbackSize = { w: 1, h: 1 }
  init() {
    return true
  }
  resize() {}
  composite(_inputs: CompositeInput[], _t?: FBOHandle | null) {}
  allocTarget(width: number, height: number): FBOHandle {
    return { id: 1, width, height }
  }
  freeTarget() {}
  targetTexture(): WebGLTexture {
    return {} as WebGLTexture
  }
  upload(): WebGLTexture {
    return {} as WebGLTexture
  }
  readback(): ImageData {
    const { w, h } = this.readbackSize
    return {
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4)
    } as unknown as ImageData
  }
  async toBlob(): Promise<Blob> {
    return new Blob()
  }
  getCanvas() {
    return this.canvas
  }
  dispose() {}
}

function probeToolContext(editor: Editor): ToolContext {
  let captured: ToolContext | null = null
  registerTool({
    id: 'probe',
    create: (ctx) => {
      captured = ctx
      return {
        id: 'probe',
        control: defaultControl(),
        onButtonPress: () => {},
        onMotion: () => {},
        onButtonRelease: () => {},
        onHover: () => {},
        cursorFor: () => 'default',
        drawOverlay: () => {}
      }
    }
  })
  editor.setTool('probe')
  return captured!
}

const ev = { pressure: 0.5, shiftKey: false } as unknown as PointerEvent

function stub2d(): () => void {
  const orig = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    kind: string
  ) {
    if (kind !== '2d') return null
    return {
      canvas: this,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      globalCompositeOperation: 'source-over',
      fillStyle: '',
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      drawImage: () => {},
      fillRect: () => {},
      clearRect: () => {},
      putImageData: () => {},
      getImageData: (_x: number, _y: number, w: number, h: number) =>
        ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4)
        }) as unknown as ImageData,
      createImageData: (w: number, h: number) =>
        ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4)
        }) as unknown as ImageData
    } as unknown as CanvasRenderingContext2D
  } as typeof HTMLCanvasElement.prototype.getContext
  return () => {
    HTMLCanvasElement.prototype.getContext = orig
  }
}

describe('OverlayList', () => {
  it('hit-tests handles and batches redraws with pause/resume', () => {
    let redraws = 0
    const o = new OverlayList(() => (redraws += 1))
    o.add({ type: 'handle', pos: { x: 10, y: 10 }, shape: 'square', id: 'se' })
    o.add({ type: 'handle', pos: { x: 50, y: 50 }, shape: 'square', id: 'nw' })
    expect(o.hitHandle({ x: 11, y: 11 }, 4)).toBe('se')
    expect(o.hitHandle({ x: 30, y: 30 }, 4)).toBeNull()

    o.pause()
    o.pause()
    o.resume()
    expect(redraws).toBe(0)
    o.resume()
    expect(redraws).toBe(1)
  })
})

describe('createEditor — end-to-end orchestration', () => {
  function setup() {
    const editor = createEditor({ compositor: new FakeCompositor() })
    return editor
  }

  it('adds a layer, records history, and makes it active', () => {
    const editor = setup()
    const r = rasterKind.create({ name: 'L1' })
    editor.addNode(r)
    expect(editor.activeNodeId()).toBe(r.id)
    expect(editor.document().root.children).toHaveLength(1)
    expect(editor.history.canUndo()).toBe(true)
  })

  it('routes pointer events through the select tool to move + undo a layer', () => {
    const editor = setup()
    const r = rasterKind.create({
      transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 }
    })
    editor.addNode(r)
    editor.setTool('select')
    editor.setActiveNode(r.id)

    editor.pointerDown(ev, { x: 50, y: 50 })
    editor.pointerMove(ev, { x: 70, y: 50 })
    editor.pointerUp(ev, { x: 70, y: 50 })
    expect(r.transform.x).toBe(20)

    editor.undo()
    expect(r.transform.x).toBe(0)
  })

  it('multi-select: selection set is the truth, active derives from its tail', () => {
    const editor = setup()
    const a = rasterKind.create({ name: 'a' })
    const b = rasterKind.create({ name: 'b' })
    editor.addNode(a)
    editor.addNode(b)
    editor.setSelectedNodes([a.id, b.id])
    expect(editor.selectedNodeIds()).toEqual([a.id, b.id])
    expect(editor.activeNodeId()).toBe(b.id)
    editor.setActiveNode(a.id)
    expect(editor.selectedNodeIds()).toEqual([a.id])
  })

  it('multi-select survives undo/redo of structural changes (stale ids filtered on read)', () => {
    const editor = setup()
    const a = rasterKind.create({ name: 'a' })
    editor.addNode(a)
    editor.undo()
    expect(editor.selectedNodeIds()).toEqual([])
    expect(editor.activeNodeId()).toBeNull()
    editor.redo()
    expect(editor.selectedNodeIds()).toEqual([a.id])
  })

  it('select tool drags every selected layer and undoes as one step', () => {
    const editor = setup()
    const a = rasterKind.create({
      transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 }
    })
    const b = rasterKind.create({
      transform: { x: 200, y: 0, w: 100, h: 100, rotation: 0 }
    })
    editor.addNode(a)
    editor.addNode(b)
    editor.setTool('select')
    editor.setSelectedNodes([a.id, b.id])

    editor.pointerDown(ev, { x: 50, y: 50 })
    editor.pointerMove(ev, { x: 70, y: 60 })
    editor.pointerUp(ev, { x: 70, y: 60 })
    expect(a.transform).toMatchObject({ x: 20, y: 10 })
    expect(b.transform).toMatchObject({ x: 220, y: 10 })

    editor.undo()
    expect(a.transform).toMatchObject({ x: 0, y: 0 })
    expect(b.transform).toMatchObject({ x: 200, y: 0 })
  })

  it('transform commits keep the original pixels: shrink then enlarge loses nothing', () => {
    const restore = stub2d()
    try {
      const editor = setup()
      const canvas = document.createElement('canvas')
      canvas.width = 1000
      canvas.height = 1000
      const cid = editor.content.register(canvas)
      const r = rasterKind.create({
        contentId: cid,
        naturalWidth: 1000,
        naturalHeight: 1000,
        transform: { x: 0, y: 0, w: 1000, h: 1000, rotation: 0 }
      })
      editor.addNode(r)
      editor.setTool('transform')

      editor.pointerDown(ev, { x: 1000, y: 1000 })
      editor.pointerMove(ev, { x: 100, y: 100 })
      editor.pointerUp(ev, { x: 100, y: 100 })
      expect(editor.transformApply()).toBe(true)
      expect(r.transform.w).toBeCloseTo(100)
      expect(r.contentId).toBe(cid)
      expect(r.naturalWidth).toBe(1000)

      editor.pointerDown(ev, { x: 100, y: 100 })
      editor.pointerMove(ev, { x: 1000, y: 1000 })
      editor.pointerUp(ev, { x: 1000, y: 1000 })
      expect(editor.transformApply()).toBe(true)
      expect(r.transform.w).toBeCloseTo(1000)
      expect(r.contentId).toBe(cid)
      expect(r.naturalWidth).toBe(1000)
    } finally {
      restore()
    }
  })

  it('switches tools', () => {
    const editor = setup()
    editor.setTool('transform')
    expect(editor.activeToolId()).toBe('transform')
  })

  it('selection: selectAll covers the canvas and selectNone clears it', () => {
    const restore = stub2d()
    try {
      const editor = setup()
      const { width, height } = editor.document()
      editor.selectAll()
      expect(editor.selectionBounds()).toEqual({
        x: 0,
        y: 0,
        w: width,
        h: height
      })
      editor.selectNone()
      expect(editor.selectionBounds()).toBeNull()
    } finally {
      restore()
    }
  })

  it('floating: start centers on the canvas, anchor-as-new creates a layer, undo removes it', () => {
    const editor = setup()
    const layoutDoc = editor.document()
    layoutDoc.width = 200
    layoutDoc.height = 200
    const img = document.createElement('canvas')
    img.width = 40
    img.height = 20
    const cid = editor.content.register(img, { uploadedUrl: 'http://x/f.png' })

    editor.startFloating(cid, 40, 20)
    const f = editor.floating()
    expect(f).not.toBeNull()
    expect(f!.transform).toMatchObject({
      x: 80,
      y: 90,
      w: 40,
      h: 20,
      rotation: 0
    })
    expect(editor.document().root.children).toHaveLength(0)

    editor.anchorFloating('new')
    expect(editor.floating()).toBeNull()
    const layer = editor.document().root.children[0] as {
      contentId: string
      url?: string
      transform: { x: number }
    }
    expect(layer.contentId).toBe(cid)
    expect(layer.url).toBe('http://x/f.png')
    expect(layer.transform.x).toBe(80)

    editor.undo()
    expect(editor.document().root.children).toHaveLength(0)
  })

  it('floating: anchor into the active layer merges and grows the buffer to the union', () => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string
    ) {
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
        clearRect: () => {}
      } as unknown as CanvasRenderingContext2D
    } as typeof HTMLCanvasElement.prototype.getContext
    try {
      const editor = setup()
      const layoutDoc = editor.document()
      layoutDoc.width = 200
      layoutDoc.height = 200
      const base = document.createElement('canvas')
      base.width = 100
      base.height = 100
      const baseId = editor.content.register(base)
      const layer = rasterKind.create({
        name: 'target',
        contentId: baseId,
        naturalWidth: 100,
        naturalHeight: 100,
        transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 }
      })
      editor.addNode(layer)

      const img = document.createElement('canvas')
      img.width = 40
      img.height = 40
      const fid = editor.content.register(img)
      editor.startFloating(fid, 40, 40)
      editor.floating()!.transform.x = 120
      editor.floating()!.transform.y = 120

      editor.anchorFloating('active')
      expect(editor.floating()).toBeNull()
      expect(editor.document().root.children).toHaveLength(1)
      expect(layer.contentId).not.toBe(baseId)
      expect(layer.url).toBeUndefined()
      expect(layer.naturalWidth).toBe(160)
      expect(layer.naturalHeight).toBe(160)
      expect(layer.transform).toMatchObject({
        x: 0,
        y: 0,
        w: 160,
        h: 160,
        rotation: 0
      })

      editor.undo()
      expect(layer.contentId).toBe(baseId)
      expect(layer.naturalWidth).toBe(100)
    } finally {
      HTMLCanvasElement.prototype.getContext = orig
    }
  })

  it('floating: cancel discards and frees the content', () => {
    const editor = setup()
    const img = document.createElement('canvas')
    img.width = 10
    img.height = 10
    const cid = editor.content.register(img)
    editor.startFloating(cid, 10, 10)
    editor.cancelFloating()
    expect(editor.floating()).toBeNull()
    expect(editor.content.has(cid)).toBe(false)
  })
})

function makeEditor() {
  const comp = new FakeCompositor()
  const editor = createEditor({ compositor: comp })
  return { editor, comp }
}

function childIds(editor: Editor): string[] {
  return editor.document().root.children.map((n) => n.id)
}

describe('createEditor — structure: reorder/moveNode/moveNodeTo/ungroup', () => {
  function threeLayers() {
    const { editor } = makeEditor()
    const a = rasterKind.create({ name: 'a' })
    const b = rasterKind.create({ name: 'b' })
    const c = rasterKind.create({ name: 'c' })
    editor.addNode(a)
    editor.addNode(b)
    editor.addNode(c)
    return { editor, a, b, c }
  }

  it('moveNode swaps with a plain sibling and undoes', () => {
    const { editor, a, b, c } = threeLayers()
    expect(editor.moveNode(a.id, 1)).toBe(true)
    expect(childIds(editor)).toEqual([b.id, a.id, c.id])
    editor.undo()
    expect(childIds(editor)).toEqual([a.id, b.id, c.id])
  })

  it('moveNode descends into an adjacent group and climbs back out', () => {
    const { editor } = makeEditor()
    const a = rasterKind.create({ name: 'a' })
    const child = rasterKind.create({ name: 'child' })
    const group = groupKind.create({ children: [child] })
    editor.addNode(a)
    editor.addNode(group)
    expect(editor.moveNode(a.id, 1)).toBe(true)
    expect(group.children.map((n) => n.id)).toEqual([a.id, child.id])
    expect(editor.moveNode(a.id, -1)).toBe(true)
    expect(childIds(editor)).toEqual([a.id, group.id])
  })

  it('moveNode refuses moving past the root edges or unknown ids', () => {
    const { editor, a, c } = threeLayers()
    expect(editor.moveNode(c.id, 1)).toBe(false)
    expect(editor.moveNode(a.id, -1)).toBe(false)
    expect(editor.moveNode('nope', 1)).toBe(false)
  })

  it('moveNodeTo moves into a group by id and undoes', () => {
    const { editor } = makeEditor()
    const a = rasterKind.create({ name: 'a' })
    const b = rasterKind.create({ name: 'b' })
    const group = groupKind.create({ children: [b] })
    editor.addNode(a)
    editor.addNode(group)
    expect(editor.moveNodeTo(a.id, group.id, 1)).toBe(true)
    expect(group.children.map((n) => n.id)).toEqual([b.id, a.id])
    editor.undo()
    expect(childIds(editor)).toEqual([a.id, group.id])
    expect(editor.moveNodeTo(group.id, group.id, 0)).toBe(false)
  })

  it('moveNodeTo refuses moving a group into its own descendant', () => {
    const { editor } = makeEditor()
    const inner = groupKind.create({ name: 'inner' })
    const outer = groupKind.create({ children: [inner] })
    editor.addNode(outer)
    expect(editor.moveNodeTo(outer.id, inner.id, 0)).toBe(false)
    expect(childIds(editor)).toEqual([outer.id])
  })

  it('moveNodeTo adjusts same-parent indices and refuses no-ops', () => {
    const { editor, a, b, c } = threeLayers()
    expect(editor.moveNodeTo(a.id, undefined, 1)).toBe(false)
    expect(childIds(editor)).toEqual([a.id, b.id, c.id])
    expect(editor.moveNodeTo(a.id, undefined, 3)).toBe(true)
    expect(childIds(editor)).toEqual([b.id, c.id, a.id])
    expect(editor.moveNodeTo('nope', undefined, 0)).toBe(false)
    expect(editor.moveNodeTo(b.id, c.id, 0)).toBe(false)
  })
})

describe('createEditor — floating pointer interaction', () => {
  function floatingSetup() {
    const { editor } = makeEditor()
    const layoutDoc = editor.document()
    layoutDoc.width = 200
    layoutDoc.height = 200
    const img = document.createElement('canvas')
    img.width = 40
    img.height = 20
    const cid = editor.content.register(img)
    editor.startFloating(cid, 40, 20)
    return { editor, cid }
  }

  it('dragging inside the box moves it; pointerUp ends the session', () => {
    const { editor } = floatingSetup()
    editor.pointerDown(ev, { x: 100, y: 100 })
    editor.pointerMove(ev, { x: 110, y: 105 })
    expect(editor.floating()!.transform).toMatchObject({ x: 90, y: 95 })
    editor.pointerUp(ev, { x: 110, y: 105 })
    editor.pointerMove(ev, { x: 150, y: 150 })
    expect(editor.floating()!.transform).toMatchObject({ x: 90, y: 95 })
  })

  it('dragging a corner handle resizes the box', () => {
    const { editor } = floatingSetup()
    editor.pointerDown(ev, { x: 120, y: 110 })
    editor.pointerMove(ev, { x: 140, y: 120 })
    expect(editor.floating()!.transform).toMatchObject({
      x: 80,
      y: 90,
      w: 60,
      h: 30
    })
  })

  it('dragging the rotate handle rotates; shift snaps the angle', () => {
    const { editor } = floatingSetup()
    const shiftEv = { pressure: 0.5, shiftKey: true } as unknown as PointerEvent
    editor.pointerDown(shiftEv, { x: 100, y: 66 })
    editor.pointerMove(shiftEv, { x: 137, y: 100 })
    expect(editor.floating()!.transform.rotation).toBeCloseTo(Math.PI / 2)
  })

  it('pressing outside the box anchors the floating item as a layer', () => {
    const { editor, cid } = floatingSetup()
    editor.pointerDown(ev, { x: 10, y: 10 })
    expect(editor.floating()).toBeNull()
    expect(editor.document().root.children).toHaveLength(1)
    expect((editor.document().root.children[0] as RasterData).contentId).toBe(
      cid
    )
  })

  it('cursor is default while floating', () => {
    const { editor } = floatingSetup()
    expect(editor.cursorAt({ x: 100, y: 100 })).toBe('default')
  })

  it('cursorAt delegates to the active tool when not floating', () => {
    const { editor } = makeEditor()
    const r = rasterKind.create({
      transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 }
    })
    editor.addNode(r)
    expect(editor.cursorAt({ x: 50, y: 50 })).toBe('move')
    expect(editor.cursorAt({ x: 500, y: 500 })).toBe('default')
  })

  it('anchoring a scaled floating item bakes it into a new layer', () => {
    const restore = stub2d()
    try {
      const { editor, cid } = floatingSetup()
      editor.floating()!.transform.w = 80
      editor.floating()!.transform.h = 40
      editor.anchorFloating('new')
      const layer = editor.document().root.children[0] as RasterData
      expect(layer.contentId).not.toBe(cid)
      expect(layer.transform).toMatchObject({ w: 80, h: 40, rotation: 0 })
      expect(layer.naturalWidth).toBe(80)
    } finally {
      restore()
    }
  })

  it('anchoring a scaled item without a 2d context keeps the original bitmap', () => {
    const { editor, cid } = floatingSetup()
    editor.floating()!.transform.w = 80
    editor.anchorFloating('new')
    const layer = editor.document().root.children[0] as RasterData
    expect(layer.contentId).toBe(cid)
    expect(layer.transform).toMatchObject({ w: 80 })
  })

  it('anchor into the active layer bakes its mask to the union bounds', () => {
    const restore = stub2d()
    try {
      const { editor } = makeEditor()
      const layoutDoc = editor.document()
      layoutDoc.width = 200
      layoutDoc.height = 200
      const base = document.createElement('canvas')
      base.width = 100
      base.height = 100
      const mask = document.createElement('canvas')
      mask.width = 100
      mask.height = 100
      const maskId = editor.content.register(mask)
      const layer = rasterKind.create({
        contentId: editor.content.register(base),
        naturalWidth: 100,
        naturalHeight: 100,
        transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
        mask: { id: 'm', role: 'mask', contentId: maskId, enabled: true }
      })
      editor.addNode(layer)
      const img = document.createElement('canvas')
      img.width = 40
      img.height = 40
      editor.startFloating(editor.content.register(img), 40, 40)
      editor.floating()!.transform.x = 120
      editor.floating()!.transform.y = 120
      editor.anchorFloating('active')
      expect(layer.mask!.contentId).not.toBe(maskId)
      expect(layer.naturalWidth).toBe(160)
      editor.undo()
      expect(layer.mask!.contentId).toBe(maskId)
    } finally {
      restore()
    }
  })

  it('anchorFloating with missing content just clears the floating state', () => {
    const { editor } = makeEditor()
    editor.startFloating('ghost', 10, 10)
    editor.anchorFloating()
    expect(editor.floating()).toBeNull()
    expect(editor.document().root.children).toHaveLength(0)
  })
})

describe('createEditor — tool context services', () => {
  it('compositePixels reads back the document only when sizes match', () => {
    const { editor, comp } = makeEditor()
    const layoutDoc = editor.document()
    layoutDoc.width = 32
    layoutDoc.height = 16
    const ctx = probeToolContext(editor)
    expect(ctx.compositePixels()).toBeNull()
    comp.readbackSize = { w: 32, h: 16 }
    expect(ctx.compositePixels()).toMatchObject({ width: 32, height: 16 })
  })
})
