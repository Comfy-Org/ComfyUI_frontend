import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import {
  applyLayerState,
  extractLayerState,
  parseLayerState
} from '@/renderer/extensions/compositor/composables/compositorLayerState'
import type {
  CompositeInput,
  Compositor,
  FBOHandle
} from '@/renderer/extensions/layerEditor/engine/compositor'
import type {
  ChannelData,
  RasterData
} from '@/renderer/extensions/layerEditor/engine/node'

import { reorderDropIndex } from './layerPanelDnd'
import { useLayerEditorSession } from './useLayerEditorSession'

class FakeCompositor implements Compositor {
  disposed = false
  initResult = true
  init() {
    return this.initResult
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
    return {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray(4)
    } as unknown as ImageData
  }
  async toBlob(): Promise<Blob> {
    return new Blob()
  }
  getCanvas() {
    return null
  }
  dispose() {
    this.disposed = true
  }
}

const scaleCalls: Array<[number, number]> = []
const drawImageCalls: unknown[][] = []

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
      strokeStyle: '',
      lineWidth: 1,
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: (x: number, y: number) => {
        scaleCalls.push([x, y])
      },
      setTransform: () => {},
      drawImage: (...args: unknown[]) => drawImageCalls.push(args),
      fillRect: () => {},
      strokeRect: () => {},
      clearRect: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      rect: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      setLineDash: () => {},
      putImageData: () => {},
      getImageData: (_x: number, _y: number, w: number, h: number) =>
        ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4).fill(255)
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

let restore2d: (() => void) | null = null
beforeAll(() => {
  restore2d = stub2d()
})
afterAll(() => {
  restore2d?.()
})

beforeEach(() => {
  scaleCalls.length = 0
  drawImageCalls.length = 0
  const pending = new Map<number, FrameRequestCallback>()
  let nextId = 1
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++
    pending.set(id, cb)
    queueMicrotask(() => {
      const fn = pending.get(id)
      pending.delete(id)
      fn?.(0)
    })
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pending.delete(id)
  })
})

function flushFrames(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function fakeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

const IMAGE_SIZES: Record<string, [number, number]> = {
  'a.png': [64, 48],
  'b.png': [32, 32],
  'c.png': [40, 80]
}

function makeSession(
  initResult = true,
  alphaSampler?: (canvas: HTMLCanvasElement, x: number, y: number) => number
) {
  const compositor = new FakeCompositor()
  compositor.initResult = initResult
  const session = useLayerEditorSession({
    createCompositor: () => compositor,
    loadImage: async (url) => {
      const size = IMAGE_SIZES[url]
      if (!size) throw new Error(`unknown image: ${url}`)
      return fakeCanvas(size[0], size[1])
    },
    alphaSampler
  })
  return { session, compositor }
}

async function loadedSession() {
  const made = makeSession()
  await made.session.loadImages(['a.png', 'b.png'], ['A', 'B'])
  return made
}

function makeElements() {
  const viewport = document.createElement('div')
  Object.defineProperty(viewport, 'clientWidth', {
    value: 800,
    configurable: true
  })
  Object.defineProperty(viewport, 'clientHeight', {
    value: 600,
    configurable: true
  })
  const container = document.createElement('div')
  container.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 64, height: 48 }) as DOMRect
  return {
    viewport,
    container,
    main: document.createElement('canvas'),
    overlay: document.createElement('canvas')
  }
}

function pointer(init: Partial<PointerEvent>): PointerEvent {
  return {
    button: 0,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    offsetX: 0,
    offsetY: 0,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    ...init
  } as unknown as PointerEvent
}

function key(init: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    code: '',
    key: '',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: null,
    preventDefault: () => {},
    ...init
  } as unknown as KeyboardEvent
}

function rasterLayer(
  session: ReturnType<typeof makeSession>['session'],
  index: number
): RasterData {
  const node = session.imageLayers.value[index]
  if (node.kind !== 'raster') throw new Error('expected raster layer')
  return node
}

describe('useLayerEditorSession', () => {
  describe('loadImages', () => {
    it('sizes the document to the max input dimensions and stacks layers bottom-to-top', async () => {
      const { session } = await loadedSession()
      const doc = session.editor.document()
      expect(doc.width).toBe(64)
      expect(doc.height).toBe(48)
      const children = doc.root.children
      expect(children.map((n) => n.name)).toEqual(['Background', 'A', 'B'])
      const bottom = children[1] as RasterData
      expect(bottom.naturalWidth).toBe(64)
      expect(session.content.get(bottom.contentId)?.uploadedUrl).toBe('a.png')
    })

    it('takes the max width and height across all inputs', async () => {
      const { session } = makeSession()
      await session.loadImages(['a.png', 'c.png'], ['A', 'C'])
      const doc = session.editor.document()
      expect(doc.width).toBe(64)
      expect(doc.height).toBe(80)
    })

    it('clears history so loads are not undoable', async () => {
      const { session } = await loadedSession()
      expect(session.canUndo.value).toBe(false)
    })

    it('skips images that fail to load and reports the count', async () => {
      const { session } = makeSession()
      const failed = await session.loadImages(
        ['missing.png', 'a.png'],
        ['M', 'A']
      )
      expect(failed).toBe(1)
      const doc = session.editor.document()
      expect(doc.root.children.map((n) => n.name)).toEqual(['Background', 'A'])
      expect(doc.width).toBe(64)
    })

    it('decodes through the default image loader when none is injected', async () => {
      class FakeImage {
        naturalWidth = 20
        naturalHeight = 10
        width = 20
        height = 10
        crossOrigin: string | null = null
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        set src(value: string) {
          queueMicrotask(() => {
            if (value.includes('bad')) this.onerror?.()
            else this.onload?.()
          })
        }
      }
      vi.stubGlobal('Image', FakeImage)
      const session = useLayerEditorSession({
        createCompositor: () => new FakeCompositor()
      })
      await session.loadImages(['bad.png', 'ok.png'], ['Bad', 'Ok'])
      const doc = session.editor.document()
      expect(doc.root.children.map((n) => n.name)).toEqual(['Background', 'Ok'])
      expect(doc.width).toBe(20)
      expect(doc.height).toBe(10)
    })
  })

  it('reports glOk=false and presents a cleared canvas when init fails', async () => {
    const { session } = makeSession(false)
    expect(session.glOk.value).toBe(false)
    session.setElements(makeElements())
    await flushFrames()
  })

  describe('layer ops', () => {
    it('opacity, visibility, blend, and rename are undoable', async () => {
      const { session } = await loadedSession()
      const id = session.imageLayers.value[0].id

      session.setOpacity(id, 0.5)
      expect(session.imageLayers.value[0].opacity).toBe(0.5)
      expect(session.canUndo.value).toBe(true)
      session.undo()
      expect(session.imageLayers.value[0].opacity).toBe(1)

      session.toggleVisible(id)
      expect(session.imageLayers.value[0].visible).toBe(false)
      session.undo()
      expect(session.imageLayers.value[0].visible).toBe(true)

      session.setBlendMode(id, 'multiply')
      expect(session.imageLayers.value[0].mode.blend).toBe('multiply')
      session.undo()
      expect(session.imageLayers.value[0].mode.blend).toBe('normal')

      session.renameLayer(id, ' Renamed ')
      expect(session.imageLayers.value[0].name).toBe('Renamed')
      session.undo()
      expect(session.imageLayers.value[0].name).toBe('A')
    })

    it('applies opacity to every selected layer as one undo step', async () => {
      const { session } = await loadedSession()
      const [a, b] = session.imageLayers.value.map((n) => n.id)
      session.setSelectedNodes([a, b])
      expect(session.selectedNodeIds.value).toEqual([a, b])
      session.setOpacity(a, 0.25)
      expect(session.imageLayers.value.map((n) => n.opacity)).toEqual([
        0.25, 0.25
      ])
      session.undo()
      expect(session.imageLayers.value.map((n) => n.opacity)).toEqual([1, 1])
    })

    it('reorders layers', async () => {
      const { session } = await loadedSession()
      session.moveLayer(session.imageLayers.value[0].id, 1)
      expect(session.imageLayers.value.map((n) => n.name)).toEqual(['B', 'A'])
      expect(session.layers.value[0].kind).toBe('fill')
    })

    it('moveLayerTo drops a layer at an explicit index and undoes', async () => {
      const { session } = await loadedSession()
      const [, b] = session.imageLayers.value

      session.moveLayerTo(b.id, 1)
      expect(session.imageLayers.value.map((n) => n.name)).toEqual(['B', 'A'])

      session.undo()
      expect(session.imageLayers.value.map((n) => n.name)).toEqual(['A', 'B'])
    })

    it('drag-drop math lands the dragged layer around the target in both directions', async () => {
      const { session } = makeSession()
      await session.loadImages(['a.png', 'b.png', 'c.png'], ['A', 'B', 'C'])
      const names = () => session.imageLayers.value.map((n) => n.name)
      const idOf = (name: string) =>
        session.imageLayers.value.find((n) => n.name === name)!.id
      const drop = (
        dragged: string,
        target: string,
        pos: 'above' | 'below'
      ) => {
        const toIndex = reorderDropIndex(
          session.imageLayers.value.map((n) => n.id),
          idOf(target),
          pos,
          1
        )
        session.moveLayerTo(idOf(dragged), toIndex!)
      }

      drop('A', 'C', 'above')
      expect(names()).toEqual(['B', 'C', 'A'])

      drop('A', 'B', 'below')
      expect(names()).toEqual(['A', 'B', 'C'])

      drop('C', 'B', 'below')
      expect(names()).toEqual(['A', 'C', 'B'])

      drop('A', 'B', 'below')
      expect(names()).toEqual(['C', 'A', 'B'])
    })

    it('moveLayerTo refuses to drop below the background fill', async () => {
      const { session } = await loadedSession()
      const [a] = session.imageLayers.value

      session.moveLayerTo(a.id, 0)

      expect(session.imageLayers.value.map((n) => n.name)).toEqual(['A', 'B'])
      expect(session.layers.value[0].kind).toBe('fill')
    })

    it('never swallows Escape so the dialog close stays reachable', async () => {
      const { session } = await loadedSession()
      const preventDefault = vi.fn()
      session.onKeyDown(key({ key: 'Escape', preventDefault }))
      expect(preventDefault).not.toHaveBeenCalled()
    })

    it('exposes a fresh activeNode snapshot after each edit so bindings update', async () => {
      const { session } = await loadedSession()
      const id = session.imageLayers.value[0].id
      session.setActiveNode(id)
      const before = session.activeNode.value
      expect(before?.mode.blend).toBe('normal')

      session.setBlendMode(id, 'multiply')
      const after = session.activeNode.value
      expect(after).not.toBe(before)
      expect(after?.mode.blend).toBe('multiply')
    })
  })

  describe('pointer input', () => {
    it('pans with space+drag instead of dispatching to the tool', async () => {
      const { session } = await loadedSession()
      const els = makeElements()
      session.setElements(els)
      await flushFrames()
      const before = parseFloat(els.container.style.left)

      session.onKeyDown(key({ code: 'Space' }))
      expect(session.viewportCursor.value).toBe('grab')
      session.onPointerDown(pointer({ offsetX: 100, offsetY: 100 }))
      session.onPointerMove(pointer({ offsetX: 110, offsetY: 95 }))
      await flushFrames()
      session.onPointerUp(pointer({ offsetX: 110, offsetY: 95 }))
      session.onKeyUp(key({ code: 'Space' }))

      expect(parseFloat(els.container.style.left)).toBeCloseTo(before + 10)
      expect(session.activeNodeId.value).toBe(session.imageLayers.value[1].id)
    })

    it('selects the layer under the pointer and drags it with the transform gizmo', async () => {
      const { session } = await loadedSession()
      const els = makeElements()
      session.setElements(els)
      session.setActiveNode(null)
      await flushFrames()

      session.onPointerDown(pointer({ clientX: 10, clientY: 10 }))
      const top = session.imageLayers.value[1]
      expect(session.activeNodeId.value).toBe(top.id)
      session.onPointerMove(pointer({ clientX: 20, clientY: 10, altKey: true }))
      await flushFrames()
      session.onPointerUp(pointer({ clientX: 20, clientY: 10 }))

      expect(top.transform.x).toBeCloseTo(10)
      expect(session.canUndo.value).toBe(true)
      session.undo()
      expect(top.transform.x).toBe(0)
    })

    it('clicking an overlapping upper layer selects it while a lower layer is selected', async () => {
      const { session } = await loadedSession()
      session.setElements(makeElements())
      await flushFrames()
      const [a, b] = session.imageLayers.value
      session.setActiveNode(a.id)

      session.onPointerDown(pointer({ clientX: 10, clientY: 10 }))
      session.onPointerUp(pointer({ clientX: 10, clientY: 10 }))

      expect(session.activeNodeId.value).toBe(b.id)
    })

    it('re-picks the layer on top when the selection is transparent under the click', async () => {
      const { session } = makeSession(true, (canvas) =>
        canvas.width === 64 ? 0 : 1
      )
      await session.loadImages(['a.png', 'b.png'], ['A', 'B'])
      session.setElements(makeElements())
      await flushFrames()
      const [a, b] = session.imageLayers.value
      session.setActiveNode(a.id)

      session.onPointerDown(pointer({ clientX: 10, clientY: 10 }))
      session.onPointerUp(pointer({ clientX: 10, clientY: 10 }))

      expect(session.activeNodeId.value).toBe(b.id)
    })

    it('clicks fall through transparent pixels to the layer below', async () => {
      const { session } = makeSession(true, (canvas) =>
        canvas.width === 32 ? 0 : 1
      )
      await session.loadImages(['a.png', 'b.png'], ['A', 'B'])
      session.setElements(makeElements())
      session.setActiveNode(null)
      await flushFrames()
      const [a] = session.imageLayers.value

      session.onPointerDown(pointer({ clientX: 10, clientY: 10 }))
      session.onPointerUp(pointer({ clientX: 10, clientY: 10 }))

      expect(session.activeNodeId.value).toBe(a.id)
    })

    it('gizmo handles win over re-picking even on transparent pixels', async () => {
      const { session } = makeSession(true, () => 0)
      await session.loadImages(['a.png', 'b.png'], ['A', 'B'])
      session.setElements(makeElements())
      await flushFrames()
      const [, b] = session.imageLayers.value
      session.setActiveNode(b.id)

      session.onPointerDown(pointer({ clientX: 0, clientY: 0 }))
      session.onPointerUp(pointer({ clientX: 0, clientY: 0 }))

      expect(session.selectedNodeIds.value).toEqual([b.id])
    })

    it('clears the selection on empty-space click', async () => {
      const { session } = await loadedSession()
      session.setElements(makeElements())
      await flushFrames()
      expect(session.selectedNodeIds.value).toHaveLength(1)

      session.onPointerDown(pointer({ clientX: 200, clientY: 200 }))
      session.onPointerUp(pointer({ clientX: 200, clientY: 200 }))

      expect(session.selectedNodeIds.value).toEqual([])
      expect(session.selectedContext.value).toBe('background')
    })

    it('never picks the background fill layer', async () => {
      const { session } = await loadedSession()
      session.setElements(makeElements())
      await flushFrames()
      for (const layer of session.imageLayers.value)
        session.toggleVisible(layer.id)
      session.setActiveNode(null)

      session.onPointerDown(pointer({ clientX: 10, clientY: 10 }))
      session.onPointerUp(pointer({ clientX: 10, clientY: 10 }))

      expect(session.selectedNodeIds.value).toEqual([])
      expect(session.activeNodeId.value).toBeNull()
    })

    it('keeps a multi-selection when clicking inside it and drags all members', async () => {
      const { session } = await loadedSession()
      session.setElements(makeElements())
      await flushFrames()
      const [a, b] = session.imageLayers.value
      session.setSelectedNodes([a.id, b.id])

      session.onPointerDown(pointer({ clientX: 10, clientY: 10 }))
      expect(session.selectedNodeIds.value).toEqual([a.id, b.id])
      session.onPointerMove(pointer({ clientX: 20, clientY: 10, altKey: true }))
      await flushFrames()
      session.onPointerUp(pointer({ clientX: 20, clientY: 10 }))

      expect(a.transform.x).toBeCloseTo(10)
      expect(b.transform.x).toBeCloseTo(10)
      session.undo()
      expect(a.transform.x).toBe(0)
      expect(b.transform.x).toBe(0)
    })

    it('shift-click toggles the picked layer in the selection', async () => {
      const { session } = await loadedSession()
      session.setElements(makeElements())
      await flushFrames()
      const [a, b] = session.imageLayers.value
      session.setActiveNode(a.id)

      session.onPointerDown(
        pointer({ clientX: 10, clientY: 10, shiftKey: true })
      )
      session.onPointerUp(pointer({ clientX: 10, clientY: 10, shiftKey: true }))

      expect(session.selectedNodeIds.value).toEqual([a.id, b.id])
    })

    it('pans instead of dispatching in hand mode', async () => {
      const { session } = await loadedSession()
      const els = makeElements()
      session.setElements(els)
      await flushFrames()
      const before = parseFloat(els.container.style.left)
      const selection = [...session.selectedNodeIds.value]

      session.setPointerMode('hand')
      expect(session.viewportCursor.value).toBe('grab')
      session.onPointerDown(pointer({ offsetX: 100, offsetY: 100 }))
      expect(session.viewportCursor.value).toBe('grabbing')
      session.onPointerMove(pointer({ offsetX: 112, offsetY: 100 }))
      await flushFrames()
      session.onPointerUp(pointer({ offsetX: 112, offsetY: 100 }))

      expect(parseFloat(els.container.style.left)).toBeCloseTo(before + 12)
      expect(session.selectedNodeIds.value).toEqual(selection)
      expect(session.canUndo.value).toBe(false)
    })

    it('ends the tool gesture when the pointer leaves the viewport', async () => {
      const { session } = await loadedSession()
      const els = makeElements()
      session.setElements(els)
      await flushFrames()
      const top = session.imageLayers.value[1]

      session.onPointerDown(pointer({ clientX: 10, clientY: 10 }))
      session.onPointerLeave(pointer({ clientX: 10, clientY: 10 }))
      session.onPointerMove(pointer({ clientX: 20, clientY: 10, altKey: true }))
      await flushFrames()

      expect(top.transform.x).toBe(0)
    })

    it('zooms with the wheel around the cursor', async () => {
      const { session } = await loadedSession()
      session.setElements(makeElements())
      await flushFrames()
      const before = session.zoomRatio.value
      session.onWheel({
        deltaY: -1,
        offsetX: 10,
        offsetY: 10
      } as unknown as WheelEvent)
      await flushFrames()
      expect(session.zoomRatio.value).toBeCloseTo(before * 1.1)
    })
  })

  describe('hotkeys', () => {
    it('undoes with Ctrl+Z and redoes with Ctrl+Shift+Z', async () => {
      const { session } = await loadedSession()
      const id = session.imageLayers.value[0].id
      session.setOpacity(id, 0.5)
      session.onKeyDown(key({ code: 'KeyZ', ctrlKey: true }))
      expect(session.imageLayers.value[0].opacity).toBe(1)
      session.onKeyDown(key({ code: 'KeyZ', ctrlKey: true, shiftKey: true }))
      expect(session.imageLayers.value[0].opacity).toBe(0.5)
    })

    it('Enter and Escape are harmless without a pending transform', async () => {
      const { session } = await loadedSession()
      expect(session.editor.activeToolId()).toBe('transform')
      session.onKeyDown(key({ key: 'Enter' }))
      session.onKeyDown(key({ key: 'Escape' }))
      expect(session.editor.activeToolId()).toBe('transform')
      expect(session.canUndo.value).toBe(false)
    })

    it('Delete leaves layers untouched (no delete affordance)', async () => {
      const { session } = await loadedSession()
      session.onKeyDown(key({ key: 'Delete' }))
      expect(session.layers.value.map((n) => n.name)).toEqual([
        'Background',
        'A',
        'B'
      ])
      expect(session.canUndo.value).toBe(false)
    })

    it('Ctrl+A selects all pixels and Ctrl+D drops the selection', async () => {
      const { session } = await loadedSession()
      session.setElements(makeElements())
      session.onKeyDown(key({ code: 'KeyA', ctrlKey: true }))
      expect(session.editor.selectionBounds()).toEqual({
        x: 0,
        y: 0,
        w: 64,
        h: 48
      })
      await flushFrames()
      session.onKeyDown(key({ code: 'KeyD', ctrlKey: true }))
      expect(session.editor.selectionBounds()).toBeNull()
    })

    it('Enter anchors a floating item; Escape leaves it for the dialog', async () => {
      const { session } = await loadedSession()
      session.setElements(makeElements())
      const cid = session.content.register(fakeCanvas(8, 8))
      session.editor.startFloating(cid, 8, 8, 'F')
      await flushFrames()
      session.onKeyDown(key({ key: 'Enter' }))
      expect(session.editor.floating()).toBeNull()
      expect(session.canUndo.value).toBe(true)

      const cid2 = session.content.register(fakeCanvas(8, 8))
      session.editor.startFloating(cid2, 8, 8, 'F2')
      const preventDefault = vi.fn()
      session.onKeyDown(key({ key: 'Escape', preventDefault }))
      expect(session.editor.floating()).not.toBeNull()
      expect(preventDefault).not.toHaveBeenCalled()
    })

    it('ignores hotkeys while typing in an input', async () => {
      const { session } = await loadedSession()
      const id = session.imageLayers.value[0].id
      session.setOpacity(id, 0.5)
      session.onKeyDown(
        key({
          code: 'KeyZ',
          ctrlKey: true,
          target: document.createElement('input')
        })
      )
      expect(session.imageLayers.value[0].opacity).toBe(0.5)
    })
  })

  describe('canvas size', () => {
    it('resizes the document, resizes the compositor, and undoes', async () => {
      const { session, compositor } = await loadedSession()
      const resizeSpy = vi.spyOn(compositor, 'resize')

      session.setCanvasSize(128, 96)
      expect(session.canvasSize.value).toEqual({ w: 128, h: 96 })
      expect(resizeSpy).toHaveBeenCalledWith(128, 96)

      session.undo()
      expect(session.canvasSize.value).toEqual({ w: 64, h: 48 })
      expect(resizeSpy).toHaveBeenCalledWith(64, 48)
      session.redo()
      expect(session.canvasSize.value).toEqual({ w: 128, h: 96 })
    })

    it('clamps to the supported range', async () => {
      const { session } = await loadedSession()
      session.setCanvasSize(1, 99999)
      expect(session.canvasSize.value).toEqual({ w: 64, h: 8192 })
    })

    it('grows the canvas around its center, keeping layers visually fixed', async () => {
      const { session } = await loadedSession()
      const els = makeElements()
      session.setElements(els)
      const zoom = session.zoomRatio.value
      const layer = rasterLayer(session, 0)
      const screenX = (x: number) =>
        parseFloat(els.container.style.left) + x * zoom
      const screenY = (y: number) =>
        parseFloat(els.container.style.top) + y * zoom
      const beforeX = screenX(layer.transform.x)
      const beforeY = screenY(layer.transform.y)

      session.setCanvasSize(128, 96)
      expect(session.zoomRatio.value).toBe(zoom)
      expect(layer.transform).toMatchObject({ x: 32, y: 24 })
      expect(parseFloat(els.container.style.width)).toBeCloseTo(128 * zoom)
      expect(parseFloat(els.container.style.height)).toBeCloseTo(96 * zoom)
      expect(screenX(layer.transform.x)).toBeCloseTo(beforeX)
      expect(screenY(layer.transform.y)).toBeCloseTo(beforeY)
    })

    it('keeps the container and layer positions in sync across undo/redo', async () => {
      const { session } = await loadedSession()
      const els = makeElements()
      session.setElements(els)
      const zoom = session.zoomRatio.value
      const layer = rasterLayer(session, 0)
      session.setCanvasSize(129, 97)
      expect(layer.transform).toMatchObject({ x: 32, y: 24 })

      session.undo()
      await flushFrames()
      expect(layer.transform).toMatchObject({ x: 0, y: 0 })
      expect(parseFloat(els.container.style.width)).toBeCloseTo(64 * zoom)
      expect(parseFloat(els.container.style.height)).toBeCloseTo(48 * zoom)
      expect(els.main.width).toBe(64)
      expect(els.main.height).toBe(48)

      session.redo()
      await flushFrames()
      expect(layer.transform).toMatchObject({ x: 32, y: 24 })
      expect(parseFloat(els.container.style.width)).toBeCloseTo(129 * zoom)
      expect(els.main.width).toBe(129)
    })
  })

  describe('layer transform edits', () => {
    it('sets position per axis with undo', async () => {
      const { session } = await loadedSession()
      const top = rasterLayer(session, 1)

      session.setLayerPosition(top.id, 5, 7)
      expect(top.transform.x).toBe(5)
      expect(top.transform.y).toBe(7)
      session.setLayerPosition(top.id, 9)
      expect(top.transform.x).toBe(9)
      expect(top.transform.y).toBe(7)
      session.undo()
      expect(top.transform.x).toBe(5)
      session.undo()
      expect(top.transform).toMatchObject({ x: 0, y: 0 })
    })

    it('sets dimensions with a 1px floor and undo', async () => {
      const { session } = await loadedSession()
      const top = rasterLayer(session, 1)

      session.setLayerDimensions(top.id, 100, 50)
      expect(top.transform.w).toBe(100)
      expect(top.transform.h).toBe(50)
      session.setLayerDimensions(top.id, 0)
      expect(top.transform.w).toBe(1)
      session.undo()
      session.undo()
      expect(top.transform).toMatchObject({ w: 32, h: 32 })
    })

    it('converts degrees to radians and back on undo', async () => {
      const { session } = await loadedSession()
      const top = rasterLayer(session, 1)

      session.setLayerRotationDeg(top.id, 90)
      expect(top.transform.rotation).toBeCloseTo(Math.PI / 2)
      session.undo()
      expect(top.transform.rotation).toBe(0)
    })
  })

  describe('alignLayer', () => {
    it('aligns the layer bbox to the canvas bounds', async () => {
      const { session } = await loadedSession()
      const top = rasterLayer(session, 1)

      session.alignLayer(top.id, 'right')
      expect(top.transform.x).toBe(32)
      session.alignLayer(top.id, 'centerH')
      expect(top.transform.x).toBe(16)
      session.alignLayer(top.id, 'bottom')
      expect(top.transform.y).toBe(16)
      session.alignLayer(top.id, 'centerV')
      expect(top.transform.y).toBe(8)
      session.alignLayer(top.id, 'left')
      expect(top.transform.x).toBe(0)
      session.alignLayer(top.id, 'top')
      expect(top.transform.y).toBe(0)
      session.undo()
      expect(top.transform.y).toBe(8)
    })

    it('uses the visual bounds for rotated layers', async () => {
      const { session } = await loadedSession()
      const bottom = rasterLayer(session, 0)
      session.setLayerRotationDeg(bottom.id, 90)

      session.alignLayer(bottom.id, 'left')
      expect(Math.abs(bottom.transform.x + 8)).toBeLessThanOrEqual(1)
      session.alignLayer(bottom.id, 'top')
      expect(Math.abs(bottom.transform.y - 8)).toBeLessThanOrEqual(1)
    })

    it('aligns a multi-selection as one undo step', async () => {
      const { session } = await loadedSession()
      const [a, b] = session.imageLayers.value
      session.setSelectedNodes([a.id, b.id])

      session.alignLayer(b.id, 'right')
      expect(a.transform.x).toBe(0)
      expect(b.transform.x).toBe(32)
      session.undo()
      expect(b.transform.x).toBe(0)
      expect(session.canUndo.value).toBe(false)
    })
  })

  describe('flipLayer', () => {
    it('bakes flipped content and restores the old content on undo', async () => {
      const { session } = await loadedSession()
      const top = rasterLayer(session, 1)
      const oldContentId = top.contentId

      session.flipLayer(top.id, 'h')
      expect(top.contentId).not.toBe(oldContentId)
      const flipped = session.content.get(top.contentId)
      expect(flipped?.width).toBe(32)
      expect(flipped?.height).toBe(32)
      expect(top.transform).toMatchObject({ x: 0, y: 0, w: 32, h: 32 })

      session.undo()
      expect(top.contentId).toBe(oldContentId)
    })

    it('flips the mask alongside the content', async () => {
      const { session } = await loadedSession()
      const top = rasterLayer(session, 1)
      const maskContentId = session.content.register(fakeCanvas(32, 32))
      const mask: ChannelData = {
        id: 'm1',
        role: 'mask',
        contentId: maskContentId,
        enabled: true
      }
      top.mask = mask

      session.flipLayer(top.id, 'v')
      expect(top.mask?.contentId).not.toBe(maskContentId)
      expect(session.content.get(top.mask?.contentId ?? '')?.width).toBe(32)

      session.undo()
      expect(top.mask?.contentId).toBe(maskContentId)
    })

    it('tracks flip parity per axis and layer, toggling back on double flip', async () => {
      const { session } = await loadedSession()
      const [bottom, top] = [rasterLayer(session, 0), rasterLayer(session, 1)]

      session.flipLayer(top.id, 'h')
      expect(session.layerFlips(top.id)).toEqual({ h: true, v: false })
      expect(session.layerFlips(bottom.id)).toEqual({ h: false, v: false })
      expect(scaleCalls).toContainEqual([-1, 1])

      session.flipLayer(top.id, 'v')
      expect(session.layerFlips(top.id)).toEqual({ h: true, v: true })
      expect(scaleCalls).toContainEqual([1, -1])

      session.flipLayer(top.id, 'h')
      expect(session.layerFlips(top.id)).toEqual({ h: false, v: true })
    })

    it('round-trips parity together with content in a single undo step', async () => {
      const { session } = await loadedSession()
      const top = rasterLayer(session, 1)
      const oldContentId = top.contentId

      session.flipLayer(top.id, 'h')
      const flippedContentId = top.contentId

      session.undo()
      expect(top.contentId).toBe(oldContentId)
      expect(session.layerFlips(top.id)).toEqual({ h: false, v: false })

      session.redo()
      expect(top.contentId).toBe(flippedContentId)
      expect(session.layerFlips(top.id)).toEqual({ h: true, v: false })
    })

    it('resets parity when images are reloaded', async () => {
      const { session } = await loadedSession()
      const top = rasterLayer(session, 1)
      session.flipLayer(top.id, 'v')
      expect(session.layerFlips(top.id)).toEqual({ h: false, v: true })

      await session.loadImages(['a.png'], ['A'])
      expect(session.layerFlips(top.id)).toEqual({ h: false, v: false })
    })
  })

  describe('applyLayerState integration', () => {
    it('replays saved flips onto the session, mirroring content and surviving history.clear', async () => {
      const { session } = await loadedSession()
      const [bottom, top] = [rasterLayer(session, 0), rasterLayer(session, 1)]
      const state = parseLayerState(
        JSON.stringify({
          version: 1,
          canvas: { w: 64, h: 48 },
          layers: [
            {
              name: 'A',
              visible: true,
              opacity: 1,
              blend: 'normal',
              transform: { x: 0, y: 0, w: 64, h: 48, rotation: 0 },
              flipH: false,
              flipV: false
            },
            {
              name: 'B',
              visible: true,
              opacity: 0.5,
              blend: 'multiply',
              transform: { x: 4, y: 8, w: 20, h: 10, rotation: 0 },
              flipH: true,
              flipV: true
            }
          ]
        })
      )
      expect(state).not.toBeNull()

      applyLayerState(state!, session.imageLayers.value, session)
      session.editor.history.clear()

      expect(scaleCalls).toContainEqual([-1, 1])
      expect(scaleCalls).toContainEqual([1, -1])
      expect(session.layerFlips(top.id)).toEqual({ h: true, v: true })
      expect(session.layerFlips(bottom.id)).toEqual({ h: false, v: false })
      expect(top.opacity).toBe(0.5)
      expect(top.mode.blend).toBe('multiply')
      expect(top.transform).toMatchObject({ x: 4, y: 8, w: 20, h: 10 })
      expect(session.canUndo.value).toBe(false)
    })

    it('round-trips layer stacking order through extract and apply', async () => {
      const { session } = await loadedSession()
      const [a, b] = session.imageLayers.value
      session.moveLayer(a.id, 1)
      expect(session.imageLayers.value.map((n) => n.name)).toEqual(['B', 'A'])

      const state = extractLayerState(
        session.canvasSize.value,
        session.layers.value,
        session.layerFlips,
        undefined,
        session.inputLayerIds()
      )
      expect(session.inputLayerIds()).toEqual([a.id, b.id])
      expect(state.layers.map((entry) => entry?.name)).toEqual(['A', 'B'])
      expect(state.order).toEqual([1, 0])

      const { session: fresh } = await loadedSession()
      applyLayerState(state, fresh.imageLayers.value, fresh)
      expect(fresh.imageLayers.value.map((n) => n.name)).toEqual(['B', 'A'])
      expect(fresh.layers.value[0].kind).toBe('fill')
    })
  })

  describe('selection context', () => {
    it('selectBackground selects the fill layer and switches context', async () => {
      const { session } = await loadedSession()
      expect(session.selectedContext.value).toBe('layer')
      session.selectBackground()
      expect(session.activeNodeId.value).toBe(session.backgroundLayer.value?.id)
      expect(session.selectedContext.value).toBe('background')
    })
  })

  describe('outside canvas preview', () => {
    it('previews only selected layers that cross the canvas edge', async () => {
      const { session } = await loadedSession()
      const [inside, clipped] = session.imageLayers.value
      session.setLayerPosition(clipped.id, 60, 10)
      session.setElements(makeElements())
      await flushFrames()

      session.selectBackground()
      await flushFrames()
      drawImageCalls.length = 0

      session.setSelectedNodes([clipped.id])
      await flushFrames()
      expect(drawImageCalls).toHaveLength(1)

      drawImageCalls.length = 0
      session.setSelectedNodes([inside.id])
      await flushFrames()
      expect(drawImageCalls).toHaveLength(0)
    })
  })

  describe('background layer', () => {
    it('creates a locked white fill layer at index 0 on load', async () => {
      const { session } = await loadedSession()
      const bg = session.backgroundLayer.value
      expect(bg).not.toBeNull()
      expect(session.layers.value[0].id).toBe(bg!.id)
      expect(bg!.kind).toBe('fill')
      expect(bg!.fill).toEqual({ type: 'solid', color: '#ffffff' })
      expect(bg!.opacity).toBe(1)
      expect(bg!.visible).toBe(false)
      expect(bg!.locks).toEqual({
        content: true,
        position: true,
        visibility: false
      })
      expect(session.imageLayers.value.map((n) => n.name)).toEqual(['A', 'B'])
      expect(session.canUndo.value).toBe(false)
    })

    it('keeps a single background across reloads', async () => {
      const { session } = await loadedSession()
      await session.loadImages(['a.png'], ['A2'])
      const fills = session.layers.value.filter((n) => n.kind === 'fill')
      expect(fills).toHaveLength(1)
      expect(session.layers.value[0].kind).toBe('fill')
    })

    it('changes color undoably and ignores invalid or identical colors', async () => {
      const { session } = await loadedSession()
      const bg = () => session.backgroundLayer.value!

      session.setBackgroundColor('#00DF1E')
      expect(bg().fill).toEqual({ type: 'solid', color: '#00df1e' })
      expect(session.canUndo.value).toBe(true)

      session.setBackgroundColor('#00df1e')
      session.setBackgroundColor('not-a-color')
      expect(bg().fill).toEqual({ type: 'solid', color: '#00df1e' })

      session.undo()
      expect(bg().fill).toEqual({ type: 'solid', color: '#ffffff' })
      session.redo()
      expect(bg().fill).toEqual({ type: 'solid', color: '#00df1e' })
    })

    it('changes opacity and visibility undoably', async () => {
      const { session } = await loadedSession()
      const bg = () => session.backgroundLayer.value!

      session.setBackgroundOpacity(0.3)
      expect(bg().opacity).toBe(0.3)
      session.undo()
      expect(bg().opacity).toBe(1)

      session.setBackgroundVisible(true)
      expect(bg().visible).toBe(true)
      session.setBackgroundVisible(true)
      session.undo()
      expect(bg().visible).toBe(false)
      expect(session.canUndo.value).toBe(false)
    })

    it('never moves in the stack and blocks image layers from crossing it', async () => {
      const { session } = await loadedSession()
      const bg = session.backgroundLayer.value!
      const bottomImage = session.imageLayers.value[0]

      session.moveLayer(bg.id, 1)
      session.moveLayer(bg.id, -1)
      expect(session.layers.value[0].id).toBe(bg.id)

      session.moveLayer(bottomImage.id, -1)
      expect(session.layers.value[1]).toBe(bottomImage)
      expect(session.canUndo.value).toBe(false)
    })

    it('round-trips through extract and apply, skipping the fill layer', async () => {
      const { session } = await loadedSession()
      session.setBackgroundColor('#123456')
      session.setBackgroundOpacity(0.5)
      session.setBackgroundVisible(false)

      const state = extractLayerState(
        session.canvasSize.value,
        session.layers.value,
        session.layerFlips
      )
      expect(state.background).toEqual({
        color: '#123456',
        opacity: 0.5,
        visible: false
      })
      expect(state.layers.map((entry) => entry?.name)).toEqual(['A', 'B'])

      session.setBackgroundColor('#ffffff')
      session.setBackgroundOpacity(1)
      session.setBackgroundVisible(true)

      applyLayerState(state, session.imageLayers.value, session)
      const bg = session.backgroundLayer.value!
      expect(bg.fill).toEqual({ type: 'solid', color: '#123456' })
      expect(bg.opacity).toBe(0.5)
      expect(bg.visible).toBe(false)
    })

    it('stays at the default background when saved state is not applied', async () => {
      const { session } = await loadedSession()
      const state = parseLayerState(
        JSON.stringify({
          version: 1,
          inputs: ['stale-hash'],
          background: { color: '#000000', opacity: 0.1, visible: false },
          layers: []
        })
      )
      expect(state?.background?.color).toBe('#000000')

      const bg = session.backgroundLayer.value!
      expect(bg.fill).toEqual({ type: 'solid', color: '#ffffff' })
      expect(bg.opacity).toBe(1)
      expect(bg.visible).toBe(false)
    })
  })

  it('setZoom zooms around the viewport center', async () => {
    const { session } = await loadedSession()
    session.setElements(makeElements())
    await flushFrames()
    session.setZoom(2)
    expect(session.zoomRatio.value).toBe(2)
  })

  it('dispose cancels pending frames and disposes the compositor', () => {
    vi.stubGlobal('requestAnimationFrame', () => 42)
    const cancelSpy = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancelSpy)
    const { session, compositor } = makeSession()
    session.requestRender()
    session.dispose()
    expect(cancelSpy).toHaveBeenCalledWith(42)
    expect(compositor.disposed).toBe(true)
  })
})
