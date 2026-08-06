import { beforeAll, describe, expect, it } from 'vitest'

import type { Compositor, CompositeInput, FBOHandle } from '../compositor'
import { registerBuiltinKinds } from '../kinds'
import { rasterKind } from '../kinds/raster'
import type { GroupData, RasterData } from '../node'
import type { PaintCore } from '../paint'
import { registerPaintCore } from '../paint'
import { defaultControl, registerTool } from '../tool'
import type { ToolContext } from '../tool'
import { registerBuiltinTools } from '../tools'
import { createEditor, emptyDocument } from './editor'
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

  it('removes the active layer and restores it on undo', () => {
    const editor = setup()
    const r = rasterKind.create({ name: 'gone' })
    editor.addNode(r)
    editor.setActiveNode(r.id)
    editor.removeActive()
    expect(editor.document().root.children).toHaveLength(0)
    editor.undo()
    expect(editor.document().root.children).toHaveLength(1)
  })

  it('floating item survives serialize/loadJSON (no data loss on refresh)', () => {
    const editor = setup()
    const canvas = document.createElement('canvas')
    canvas.width = 40
    canvas.height = 30
    const cid = editor.content.register(canvas, {
      uploadedUrl: 'http://x/float.png'
    })
    editor.startFloating(cid, 40, 30, 'chunk')
    expect(editor.floating()).not.toBeNull()

    const json = editor.serialize()
    const restored = setup()
    restored.loadJSON(json)
    const f = restored.floating()
    expect(f).not.toBeNull()
    expect(f!.contentId).toBe(cid)
    expect(f!.url).toBe('http://x/float.png')
    expect(f!.transform.w).toBe(40)
    expect(f!.transform.h).toBe(30)
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

  it('removeNodes deletes the whole selection as one undo step', () => {
    const editor = setup()
    const a = rasterKind.create({ name: 'a' })
    const b = rasterKind.create({ name: 'b' })
    const c = rasterKind.create({ name: 'c' })
    editor.addNode(a)
    editor.addNode(b)
    editor.addNode(c)
    expect(editor.removeNodes([a.id, c.id])).toBe(true)
    expect(editor.document().root.children.map((n) => n.id)).toEqual([b.id])
    editor.undo()
    expect(editor.document().root.children.map((n) => n.id)).toEqual([
      a.id,
      b.id,
      c.id
    ])
  })

  it('removeNodes skips descendants of a selected group (topmost filter)', () => {
    const editor = setup()
    const a = rasterKind.create({ name: 'a' })
    editor.addNode(a)
    editor.setSelectedNodes([a.id])
    editor.groupActive()
    const group = editor.document().root.children[0]
    expect(editor.removeNodes([group.id, a.id])).toBe(true)
    expect(editor.document().root.children).toHaveLength(0)
    editor.undo()
    expect(editor.document().root.children.map((n) => n.id)).toEqual([group.id])
  })

  it('groupActive wraps a multi-selection at the topmost original index', () => {
    const editor = setup()
    const a = rasterKind.create({ name: 'a' })
    const b = rasterKind.create({ name: 'b' })
    const c = rasterKind.create({ name: 'c' })
    editor.addNode(a)
    editor.addNode(b)
    editor.addNode(c)
    editor.setSelectedNodes([a.id, c.id])
    expect(editor.groupActive()).toBe(true)
    const children = editor.document().root.children
    expect(children).toHaveLength(2)
    expect(children[0].kind).toBe('group')
    expect((children[0] as GroupData).children.map((n) => n.id)).toEqual([
      a.id,
      c.id
    ])
    expect(children[1].id).toBe(b.id)
    expect(editor.activeNodeId()).toBe(children[0].id)
    editor.undo()
    expect(editor.document().root.children.map((n) => n.id)).toEqual([
      a.id,
      b.id,
      c.id
    ])
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

  it('flipImage mirrors transforms, swaps raster content, and undoes as one step', () => {
    const restore = stub2d()
    try {
      const editor = setup()
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 32
      const cid = editor.content.register(canvas)
      const r = rasterKind.create({
        name: 'photo',
        contentId: cid,
        naturalWidth: 64,
        naturalHeight: 32,
        transform: { x: 100, y: 40, w: 200, h: 80, rotation: 0.5 }
      })
      editor.addNode(r)

      expect(editor.flipImage('h')).toBe(true)
      expect(r.transform.x).toBe(1024 - 100 - 200)
      expect(r.transform.y).toBe(40)
      expect(r.transform.rotation).toBe(-0.5)
      expect(r.contentId).not.toBe(cid)
      expect(editor.content.get(r.contentId)).toBeDefined()

      editor.undo()
      expect(r.transform.x).toBe(100)
      expect(r.transform.rotation).toBe(0.5)
      expect(r.contentId).toBe(cid)

      editor.redo()
      expect(r.transform.x).toBe(724)
    } finally {
      restore()
    }
  })

  it('flipImage twice restores geometry (involution) and flips vertically', () => {
    const restore = stub2d()
    try {
      const editor = setup()
      const canvas = document.createElement('canvas')
      canvas.width = 8
      canvas.height = 8
      const r = rasterKind.create({
        contentId: editor.content.register(canvas),
        naturalWidth: 8,
        naturalHeight: 8,
        transform: { x: 10, y: 20, w: 50, h: 60, rotation: 0 }
      })
      editor.addNode(r)

      editor.flipImage('v')
      expect(r.transform.y).toBe(1024 - 20 - 60)
      expect(r.transform.x).toBe(10)
      editor.flipImage('v')
      expect(r.transform.y).toBe(20)
    } finally {
      restore()
    }
  })

  it('flipImage on an empty document is a no-op', () => {
    const editor = setup()
    expect(editor.flipImage('h')).toBe(false)
    expect(editor.history.canUndo()).toBe(false)
  })

  it('serializes the full document (width/height/root/channels)', () => {
    const editor = setup()
    editor.addNode(rasterKind.create({ name: 'L1' }))
    const s = editor.serialize() as {
      width: number
      height: number
      root: { kind: string; children: unknown[] }
    }
    expect(s.width).toBe(1024)
    expect(s.root.kind).toBe('group')
    expect(s.root.children).toHaveLength(1)
  })

  it('round-trips through serialize → loadJSON (the layer_state contract)', () => {
    const a = setup()
    a.addNode(
      rasterKind.create({
        name: 'Keep',
        contentId: 'c1',
        naturalWidth: 32,
        naturalHeight: 16
      })
    )
    const json = JSON.stringify(a.serialize())

    const b = setup()
    b.loadJSON(json)
    expect(b.document().root.children).toHaveLength(1)
    expect(b.document().root.children[0].name).toBe('Keep')
  })

  it('hydrates referenced bitmaps into the content store', async () => {
    const editor = setup()
    editor.loadJSON(
      JSON.stringify({
        width: 64,
        height: 64,
        root: {
          kind: 'group',
          children: [
            {
              kind: 'raster',
              contentId: 'cid',
              url: 'http://x/y.png',
              naturalWidth: 10,
              naturalHeight: 10
            }
          ]
        }
      })
    )
    const canvas = document.createElement('canvas')
    canvas.width = 10
    canvas.height = 10
    await editor.hydrate(async () => canvas)
    expect(editor.content.has('cid')).toBe(true)
  })

  it('switches tools', () => {
    const editor = setup()
    editor.setTool('transform')
    expect(editor.activeToolId()).toBe('transform')
  })

  it('floating: start centers on the canvas, anchor-as-new creates a layer, undo removes it', () => {
    const editor = setup()
    editor.loadJSON(
      JSON.stringify({
        width: 200,
        height: 200,
        root: { kind: 'group', children: [] }
      })
    )
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
      editor.loadJSON(
        JSON.stringify({
          width: 200,
          height: 200,
          root: { kind: 'group', children: [] }
        })
      )
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

  it('selection: setRect/selectNone are undoable and expose bounds', () => {
    const restore = stub2d()
    try {
      const editor = setup()
      editor.loadJSON(
        JSON.stringify({
          width: 100,
          height: 100,
          root: { kind: 'group', children: [] }
        })
      )
      expect(editor.selectionBounds()).toBeNull()

      expect(editor.setRectSelection({ x: 10, y: 20, w: 30, h: 40 })).toBe(true)
      expect(editor.selectionBounds()).toEqual({ x: 10, y: 20, w: 30, h: 40 })
      expect(editor.document().selectionId).toBeTruthy()

      expect(editor.selectNone()).toBe(true)
      expect(editor.selectionBounds()).toBeNull()

      editor.undo()
      expect(editor.selectionBounds()).toEqual({ x: 10, y: 20, w: 30, h: 40 })
      editor.undo()
      expect(editor.selectionBounds()).toBeNull()
    } finally {
      restore()
    }
  })

  it('selection: rect is clamped to the document and serialized', () => {
    const restore = stub2d()
    try {
      const editor = setup()
      editor.loadJSON(
        JSON.stringify({
          width: 100,
          height: 100,
          root: { kind: 'group', children: [] }
        })
      )
      editor.setRectSelection({ x: -10, y: 50, w: 50, h: 200 })
      expect(editor.selectionBounds()).toEqual({ x: 0, y: 50, w: 40, h: 50 })
      const s = editor.serialize() as {
        channels: unknown[]
        selectionId?: string
      }
      expect(s.channels).toHaveLength(1)
      expect(s.selectionId).toBe(editor.document().selectionId)
    } finally {
      restore()
    }
  })

  it('selection: selectAll covers the canvas; floating centers on the selection', () => {
    const restore = stub2d()
    try {
      const editor = setup()
      editor.loadJSON(
        JSON.stringify({
          width: 200,
          height: 200,
          root: { kind: 'group', children: [] }
        })
      )
      editor.setRectSelection({ x: 100, y: 100, w: 80, h: 80 })
      const img = document.createElement('canvas')
      img.width = 20
      img.height = 20
      const cid = editor.content.register(img)
      editor.startFloating(cid, 20, 20)
      expect(editor.floating()!.transform).toMatchObject({ x: 130, y: 130 })
      editor.cancelFloating()

      editor.selectAll()
      expect(editor.selectionBounds()).toEqual({ x: 0, y: 0, w: 200, h: 200 })
    } finally {
      restore()
    }
  })

  it('deleting a layer keeps its pixels alive for undo (structure commands hold refs)', () => {
    const editor = setup()
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 8
    const cid = editor.content.register(c)
    const layer = rasterKind.create({
      name: 'L',
      contentId: cid,
      naturalWidth: 8,
      naturalHeight: 8
    })
    editor.addNode(layer)
    editor.setActiveNode(layer.id)

    editor.removeActive()
    expect(editor.content.has(cid)).toBe(true)

    editor.undo()
    expect(editor.document().root.children).toHaveLength(1)
    expect(editor.content.has(cid)).toBe(true)
  })

  it('collects content unreferenced by the document or history', async () => {
    const { SetContentCommand } = await import('../commands/setContent')
    const editor = setup()
    const c = () => {
      const el = document.createElement('canvas')
      el.width = 4
      el.height = 4
      return el
    }
    const a = editor.content.register(c())
    const raster = rasterKind.create({ name: 'L', contentId: a })
    editor.addNode(raster)

    const b = editor.content.register(c())
    raster.contentId = b
    editor.history.push(
      new SetContentCommand('Paint', raster, a, b, editor.content)
    )
    expect(editor.content.has(a)).toBe(true)

    editor.history.clear()
    expect(editor.content.has(a)).toBe(false)
    expect(editor.content.has(b)).toBe(true)
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

  it('reorder moves a child to the target index and undoes', () => {
    const { editor, a, b, c } = threeLayers()
    editor.reorder(c.id, 0)
    expect(childIds(editor)).toEqual([c.id, a.id, b.id])
    editor.undo()
    expect(childIds(editor)).toEqual([a.id, b.id, c.id])
  })

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
    editor.addNode(a)
    editor.addNode(child)
    editor.setSelectedNodes([child.id])
    editor.groupActive()
    const group = editor.document().root.children[1] as GroupData
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
    editor.addNode(a)
    editor.addNode(b)
    editor.setSelectedNodes([b.id])
    editor.groupActive()
    const group = editor.document().root.children[1] as GroupData
    expect(editor.moveNodeTo(a.id, group.id, 1)).toBe(true)
    expect(group.children.map((n) => n.id)).toEqual([b.id, a.id])
    editor.undo()
    expect(childIds(editor)).toEqual([a.id, group.id])
    expect(editor.moveNodeTo(group.id, group.id, 0)).toBe(false)
  })

  it('moveNodeTo refuses moving a group into its own descendant', () => {
    const { editor } = makeEditor()
    const a = rasterKind.create({ name: 'a' })
    editor.addNode(a)
    editor.setSelectedNodes([a.id])
    editor.groupActive()
    const inner = editor.document().root.children[0] as GroupData
    editor.setSelectedNodes([inner.id])
    editor.groupActive()
    const outer = editor.document().root.children[0] as GroupData
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

  it('ungroupActive splices children back and restores on undo', () => {
    const { editor } = makeEditor()
    const a = rasterKind.create({ name: 'a' })
    const b = rasterKind.create({ name: 'b' })
    editor.addNode(a)
    editor.addNode(b)
    editor.setSelectedNodes([a.id, b.id])
    editor.groupActive()
    const group = editor.document().root.children[0] as GroupData
    editor.setActiveNode(group.id)
    expect(editor.ungroupActive()).toBe(true)
    expect(childIds(editor)).toEqual([a.id, b.id])
    expect(editor.selectedNodeIds()).toEqual([a.id, b.id])
    editor.undo()
    expect(childIds(editor)).toEqual([group.id])
  })

  it('ungroupActive refuses a non-group active node', () => {
    const { editor, a } = threeLayers()
    editor.setActiveNode(a.id)
    expect(editor.ungroupActive()).toBe(false)
  })

  it('arrangeSelected aligns the selection and undoes in one step', () => {
    const { editor } = makeEditor()
    const a = rasterKind.create({
      transform: { x: 0, y: 0, w: 50, h: 50, rotation: 0 }
    })
    const b = rasterKind.create({
      transform: { x: 200, y: 30, w: 50, h: 50, rotation: 0 }
    })
    editor.addNode(a)
    editor.addNode(b)
    editor.setSelectedNodes([a.id, b.id])
    expect(editor.arrangeSelected('left')).toBe(true)
    expect(b.transform.x).toBe(0)
    editor.undo()
    expect(b.transform.x).toBe(200)
    editor.setSelectedNodes([a.id])
    expect(editor.arrangeSelected('left')).toBe(false)
  })
})

describe('createEditor — guides, zoom, snap grid', () => {
  it('guide add/keep is undoable; discard leaves no trace', () => {
    const { editor } = makeEditor()
    const idx = editor.guideAddLive('x', 100)
    editor.guideMoveLive(idx, 120)
    editor.guideEndDrag(idx, { added: true, keep: true })
    expect(editor.guides()).toEqual([{ axis: 'x', pos: 120 }])
    editor.undo()
    expect(editor.guides()).toEqual([])
    editor.redo()
    expect(editor.guides()).toEqual([{ axis: 'x', pos: 120 }])

    const j = editor.guideAddLive('y', 40)
    editor.guideEndDrag(j, { added: true, keep: false })
    expect(editor.guides()).toEqual([{ axis: 'x', pos: 120 }])
  })

  it('guide move and remove push undoable commands', () => {
    const { editor } = makeEditor()
    const idx = editor.guideAddLive('y', 50)
    editor.guideEndDrag(idx, { added: true, keep: true })
    editor.guideMoveLive(0, 80)
    editor.guideEndDrag(0, { added: false, beforePos: 50, keep: true })
    expect(editor.guides()).toEqual([{ axis: 'y', pos: 80 }])
    editor.undo()
    expect(editor.guides()).toEqual([{ axis: 'y', pos: 50 }])
    editor.redo()
    editor.guideEndDrag(0, { added: false, keep: false })
    expect(editor.guides()).toEqual([])
    editor.undo()
    expect(editor.guides()).toEqual([{ axis: 'y', pos: 80 }])
  })

  it('guides show up in the overlay as document-spanning lines', () => {
    const { editor } = makeEditor()
    editor.guideAddLive('x', 100)
    editor.guideAddLive('y', 60)
    const lines = editor.overlay.items.filter((i) => i.type === 'line')
    expect(lines).toEqual([
      { type: 'line', a: { x: 100, y: 0 }, b: { x: 100, y: 1024 } },
      { type: 'line', a: { x: 0, y: 60 }, b: { x: 1024, y: 60 } }
    ])
  })

  it('zoom is stored as-is and snap grid clamps negatives to zero', () => {
    const { editor } = makeEditor()
    editor.setZoom(2.5)
    expect(editor.zoom()).toBe(2.5)
    editor.setSnapGrid(16)
    expect(editor.snapGrid()).toBe(16)
    editor.setSnapGrid(-3)
    expect(editor.snapGrid()).toBe(0)
  })
})

describe('createEditor — floating pointer interaction', () => {
  function floatingSetup() {
    const { editor } = makeEditor()
    editor.loadJSON(
      JSON.stringify({
        width: 200,
        height: 200,
        root: { kind: 'group', children: [] }
      })
    )
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

  it('hover and cursor are inert while floating', () => {
    const { editor } = floatingSetup()
    editor.hover(ev, { x: 100, y: 100 })
    expect(editor.cursorAt({ x: 100, y: 100 })).toBe('default')
  })

  it('cursorAt delegates to the active tool when not floating', () => {
    const { editor } = makeEditor()
    const r = rasterKind.create({
      transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 }
    })
    editor.addNode(r)
    editor.hover(ev, { x: 50, y: 50 })
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
      editor.loadJSON(
        JSON.stringify({
          width: 200,
          height: 200,
          root: { kind: 'group', children: [] }
        })
      )
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

describe('createEditor — document lifecycle', () => {
  it('loadDocument replaces state and clears history and floating', () => {
    const { editor } = makeEditor()
    editor.addNode(rasterKind.create({ name: 'old' }))
    const img = document.createElement('canvas')
    editor.startFloating(editor.content.register(img), 4, 4)
    const doc = emptyDocument(64, 32)
    editor.loadDocument(doc)
    expect(editor.document()).toBe(doc)
    expect(editor.floating()).toBeNull()
    expect(editor.history.canUndo()).toBe(false)
    expect(editor.selectedNodeIds()).toEqual([])
  })

  it('hydrates a floating item from its uploaded url', async () => {
    const a = makeEditor().editor
    const img = document.createElement('canvas')
    img.width = 12
    img.height = 8
    const cid = a.content.register(img, { uploadedUrl: 'http://x/f.png' })
    a.startFloating(cid, 12, 8)
    const json = a.serialize()

    const b = makeEditor().editor
    b.loadJSON(json)
    expect(b.content.has(cid)).toBe(false)
    const canvas = document.createElement('canvas')
    await b.hydrate(async () => canvas)
    expect(b.content.has(cid)).toBe(true)
    expect(b.content.get(cid)!.uploadedUrl).toBe('http://x/f.png')
  })

  it('hydrates channels from their urls and survives load failures', async () => {
    const { editor } = makeEditor()
    editor.loadJSON(
      JSON.stringify({
        width: 32,
        height: 32,
        root: { kind: 'group', children: [] },
        channels: [
          {
            id: 'ok',
            role: 'selection',
            contentId: 'c-ok',
            enabled: true,
            url: 'http://x/ok.png'
          },
          {
            id: 'bad',
            role: 'selection',
            contentId: 'c-bad',
            enabled: true,
            url: 'http://x/bad.png'
          }
        ]
      })
    )
    const canvas = document.createElement('canvas')
    await editor.hydrate(async (url) => {
      if (url.endsWith('bad.png')) throw new Error('404')
      return canvas
    })
    expect(editor.content.has('c-ok')).toBe(true)
    expect(editor.content.has('c-bad')).toBe(false)
  })

  it('a failing floating hydrate leaves the content missing without throwing', async () => {
    const { editor } = makeEditor()
    editor.loadJSON({
      width: 32,
      height: 32,
      root: { kind: 'group', children: [] },
      floating: {
        contentId: 'fc',
        url: 'http://x/gone.png',
        transform: { x: 0, y: 0, w: 4, h: 4, rotation: 0 }
      }
    })
    await editor.hydrate(async () => {
      throw new Error('404')
    })
    expect(editor.content.has('fc')).toBe(false)
  })
})

describe('createEditor — tool context services', () => {
  it('setPaintPreview with rects accumulates partial present damage', () => {
    const { editor } = makeEditor()
    const ctx = probeToolContext(editor)
    editor.takePresentDamage()
    const c = document.createElement('canvas')
    ctx.setPaintPreview('content:x', c, { x: 0, y: 0, w: 10, h: 10 })
    ctx.setPaintPreview('content:x', c, [{ x: 20, y: 20, w: 5, h: 5 }])
    ctx.requestRender()
    expect(editor.takePresentDamage()).toEqual({
      full: false,
      rect: { x: 0, y: 0, w: 25, h: 25 }
    })
    expect(editor.paintPreview('content:x')).toBe(c)

    ctx.setPaintPreview('content:x', c, [])
    ctx.requestRender()
    expect(editor.takePresentDamage()).toEqual({ full: true, rect: null })

    ctx.setPaintPreview('content:x', null)
    expect(editor.paintPreview('content:x')).toBeNull()
  })

  it('editor.setPaintPreview stores and clears preview canvases', () => {
    const { editor } = makeEditor()
    const c = document.createElement('canvas')
    editor.setPaintPreview('k', c)
    expect(editor.paintPreview('k')).toBe(c)
    editor.setPaintPreview('k', null)
    expect(editor.paintPreview('k')).toBeNull()
  })

  it('compositePixels reads back the document only when sizes match', () => {
    const { editor, comp } = makeEditor()
    editor.loadJSON(
      JSON.stringify({
        width: 32,
        height: 16,
        root: { kind: 'group', children: [] }
      })
    )
    const ctx = probeToolContext(editor)
    expect(ctx.compositePixels()).toBeNull()
    comp.readbackSize = { w: 32, h: 16 }
    expect(ctx.compositePixels()).toMatchObject({ width: 32, height: 16 })
  })

  it('createPaintCore resolves registered cores; zoom/snap reflect editor state', () => {
    const { editor } = makeEditor()
    const core = {} as PaintCore
    registerPaintCore({ id: 'probe-core', create: () => core })
    const ctx = probeToolContext(editor)
    expect(ctx.createPaintCore('probe-core')).toBe(core)
    editor.setZoom(3)
    editor.setSnapGrid(8)
    expect(ctx.zoom()).toBe(3)
    expect(ctx.snapGrid()).toBe(8)
    expect(ctx.floatSelection()).toBe(false)
  })
})

describe('createEditor — layer ops and flatten', () => {
  function canvasOf(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }

  it('mergeDown merges into the layer below through the editor facade', () => {
    const restore = stub2d()
    try {
      const { editor } = makeEditor()
      const a = rasterKind.create({
        name: 'bottom',
        contentId: editor.content.register(canvasOf(20, 20)),
        naturalWidth: 20,
        naturalHeight: 20,
        transform: { x: 0, y: 0, w: 20, h: 20, rotation: 0 }
      })
      editor.addNode(a)
      const b = rasterKind.create({
        name: 'top',
        contentId: editor.content.register(canvasOf(20, 20)),
        naturalWidth: 20,
        naturalHeight: 20,
        transform: { x: 10, y: 10, w: 20, h: 20, rotation: 0 }
      })
      editor.addNode(b)
      expect(editor.mergeDown(b.id)).toBe(true)
      expect(editor.document().root.children).toHaveLength(1)
      editor.undo()
      expect(editor.document().root.children).toHaveLength(2)
      expect(editor.mergeDown(a.id)).toBe(false)
    } finally {
      restore()
    }
  })

  it('rasterizeLayer bakes a scaled placement; canRasterize gates identity', () => {
    const restore = stub2d()
    try {
      const { editor } = makeEditor()
      const r = rasterKind.create({
        contentId: editor.content.register(canvasOf(40, 40)),
        naturalWidth: 40,
        naturalHeight: 40,
        transform: { x: 0, y: 0, w: 80, h: 80, rotation: 0 }
      })
      editor.addNode(r)
      expect(editor.canRasterize(r.id)).toBe(true)
      expect(editor.rasterizeLayer(r.id)).toBe(true)
      expect(r.naturalWidth).toBe(80)
      expect(r.transform).toMatchObject({ w: 80, h: 80, rotation: 0 })
      expect(editor.canRasterize(r.id)).toBe(false)
      expect(editor.rasterizeLayer(r.id)).toBe(false)
      editor.undo()
      expect(r.naturalWidth).toBe(40)
    } finally {
      restore()
    }
  })

  it('layerToCanvasSize expands a layer to the document size', () => {
    const restore = stub2d()
    try {
      const { editor } = makeEditor()
      editor.loadJSON(
        JSON.stringify({
          width: 64,
          height: 64,
          root: { kind: 'group', children: [] }
        })
      )
      const r = rasterKind.create({
        contentId: editor.content.register(canvasOf(10, 10)),
        naturalWidth: 10,
        naturalHeight: 10,
        transform: { x: 5, y: 5, w: 10, h: 10, rotation: 0 }
      })
      editor.addNode(r)
      expect(editor.layerToCanvasSize(r.id)).toBe(true)
      expect(r.transform).toEqual({ x: 0, y: 0, w: 64, h: 64, rotation: 0 })
      editor.undo()
      expect(r.transform).toEqual({ x: 5, y: 5, w: 10, h: 10, rotation: 0 })
      expect(editor.cropToContent(r.id)).toBe(false)
    } finally {
      restore()
    }
  })

  it('flattenImage collapses all layers into one Background as one undo step', () => {
    const restore = stub2d()
    try {
      const { editor, comp } = makeEditor()
      editor.loadJSON(
        JSON.stringify({
          width: 32,
          height: 32,
          root: { kind: 'group', children: [] }
        })
      )
      expect(editor.flattenImage()).toBe(false)
      comp.canvas = document.createElement('canvas')
      comp.readbackSize = { w: 32, h: 32 }
      expect(editor.flattenImage()).toBe(false)
      editor.addNode(
        rasterKind.create({
          name: 'a',
          contentId: editor.content.register(canvasOf(8, 8)),
          naturalWidth: 8,
          naturalHeight: 8
        })
      )
      editor.addNode(
        rasterKind.create({
          name: 'b',
          contentId: editor.content.register(canvasOf(8, 8)),
          naturalWidth: 8,
          naturalHeight: 8
        })
      )
      expect(editor.flattenImage('#336699')).toBe(true)
      const children = editor.document().root.children
      expect(children).toHaveLength(1)
      expect(children[0].name).toBe('Background')
      expect(editor.activeNodeId()).toBe(children[0].id)
      editor.undo()
      expect(editor.document().root.children.map((n) => n.name)).toEqual([
        'a',
        'b'
      ])
    } finally {
      restore()
    }
  })
})
