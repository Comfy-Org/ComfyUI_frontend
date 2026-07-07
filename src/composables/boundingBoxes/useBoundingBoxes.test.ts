import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref, ShallowRef } from 'vue'
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'

import { useBoundingBoxes } from './useBoundingBoxes'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import type { BoundingBox } from '@/types/boundingBoxes'
import { toNodeId } from '@/types/nodeId'

const { appState } = vi.hoisted(() => ({
  appState: { node: null as unknown }
}))

vi.mock('@/scripts/app', () => ({
  app: { canvas: { graph: { getNodeById: () => appState.node } } }
}))

const ctxObj: unknown = {
  measureText: (s: string) => ({ width: s.length * 7 }),
  setTransform: () => {},
  clearRect: () => {},
  fillRect: () => {},
  strokeRect: () => {},
  fillText: () => {},
  drawImage: () => {},
  save: () => {},
  restore: () => {},
  beginPath: () => {},
  rect: () => {},
  clip: () => {},
  font: '',
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0
}
const ctx = ctxObj as CanvasRenderingContext2D

function makeCanvas(
  options: {
    context?: CanvasRenderingContext2D | null
    clientWidth?: number
    clientHeight?: number
  } = {}
): HTMLCanvasElement {
  const el = document.createElement('canvas')
  Object.defineProperty(el, 'clientWidth', {
    value: options.clientWidth ?? 100,
    configurable: true
  })
  Object.defineProperty(el, 'clientHeight', {
    value: options.clientHeight ?? 100,
    configurable: true
  })
  const getCtx: unknown = () =>
    options.context === undefined ? ctx : options.context
  el.getContext = getCtx as HTMLCanvasElement['getContext']
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    }) as DOMRect
  el.focus = () => {}
  el.setPointerCapture = () => {}
  el.releasePointerCapture = () => {}
  return el
}

function makeNode() {
  return {
    widgets: [
      { name: 'width', value: 512 },
      { name: 'height', value: 512 }
    ],
    findInputSlot: () => -1,
    getInputNode: () => null
  }
}

const pe = (
  clientX: number,
  clientY: number,
  over: Partial<PointerEvent> = {}
) =>
  fromPartial<PointerEvent>({
    button: 0,
    clientX,
    clientY,
    altKey: false,
    pointerId: 1,
    preventDefault: () => {},
    stopPropagation: () => {},
    ...over
  })

const flush = async () => {
  await Promise.resolve()
  await nextTick()
}

type Api = ReturnType<typeof useBoundingBoxes>
interface Captured extends Api {
  canvasEl: ShallowRef<HTMLCanvasElement | null>
  modelValue: Ref<BoundingBox[]>
}

function setup(initial: BoundingBox[] | undefined = []) {
  let captured: Captured | undefined
  const Harness = defineComponent({
    setup() {
      const canvasEl = shallowRef<HTMLCanvasElement | null>(null)
      const canvasContainer = shallowRef<HTMLDivElement | null>(null)
      const inlineEditorEl = shallowRef<HTMLTextAreaElement | null>(null)
      const modelValue = ref(initial as BoundingBox[])
      const api = useBoundingBoxes(toNodeId('1'), {
        canvasEl,
        canvasContainer,
        inlineEditorEl,
        modelValue
      })
      captured = { canvasEl, modelValue, ...api }
      return () => h('div')
    }
  })
  render(Harness)
  captured!.canvasEl.value = makeCanvas()
  return captured!
}

const box = (over: Partial<BoundingBox> = {}): BoundingBox => ({
  x: 51,
  y: 51,
  width: 256,
  height: 256,
  metadata: { type: 'obj', text: '', desc: '', palette: ['#ff0000'] },
  ...over
})

beforeEach(() => {
  setActivePinia(createPinia())
  appState.node = makeNode()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    void Promise.resolve().then(() => cb(0))
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useBoundingBoxes initialization', () => {
  it('derives regions from the initial model value', () => {
    const c = setup([box()])
    expect(c.hasRegions.value).toBe(true)
    expect(c.activeRegion.value).toMatchObject({ type: 'obj' })
  })

  it('exposes an aspect-ratio canvas style from the node width/height', () => {
    const c = setup()
    expect(c.canvasStyle.value).toEqual({ aspectRatio: '512 / 512' })
  })

  it('starts with no active region when empty', () => {
    const c = setup()
    expect(c.hasRegions.value).toBe(false)
    expect(c.activeRegion.value).toBeNull()
  })

  it('falls back to default dimensions when the litegraph node is unavailable', () => {
    appState.node = null
    const c = setup([box()])
    expect(c.canvasStyle.value).toEqual({ aspectRatio: '1024 / 1024' })
  })

  it('ignores non-positive dimension widgets', () => {
    appState.node = {
      widgets: [
        { name: 'width', value: 0 },
        { name: 'height', value: 'bad' }
      ],
      findInputSlot: () => -1,
      getInputNode: () => null
    }
    const c = setup()
    expect(c.canvasStyle.value).toEqual({ aspectRatio: '1024 / 1024' })
  })

  it('treats an undefined model value as empty', () => {
    const c = setup(undefined)
    expect(c.hasRegions.value).toBe(false)
    expect(c.modelValue.value).toEqual([])
  })
})

describe('useBoundingBoxes drawing', () => {
  it('ignores non-primary pointer buttons', async () => {
    const c = setup()
    c.onPointerDown(pe(10, 10, { button: 1 }))
    c.onCanvasPointerMove(pe(60, 60))
    c.onDocPointerUp(pe(60, 60))
    await flush()
    expect(c.modelValue.value).toHaveLength(0)
  })

  it('draws a new region and syncs it to the model value', async () => {
    const c = setup()
    c.onPointerDown(pe(10, 10))
    c.onCanvasPointerMove(pe(60, 60))
    c.onDocPointerUp(pe(60, 60))
    await flush()
    expect(c.modelValue.value).toHaveLength(1)
    expect(c.modelValue.value[0].width).toBeGreaterThan(0)
  })

  it('discards a zero-size draw', async () => {
    const c = setup()
    c.onPointerDown(pe(10, 10))
    c.onDocPointerUp(pe(10, 10))
    await flush()
    expect(c.modelValue.value).toHaveLength(0)
  })

  it('selects an existing region instead of drawing when clicking inside it', async () => {
    const c = setup([box()])
    c.onPointerDown(pe(30, 30))
    c.onDocPointerUp(pe(30, 30))
    await flush()
    expect(c.modelValue.value).toHaveLength(1)
  })

  it('moves an existing active region by dragging inside it', async () => {
    const c = setup([box()])
    c.onPointerDown(pe(30, 30))
    c.onCanvasPointerMove(pe(45, 50))
    c.onDocPointerUp(pe(45, 50))
    await flush()
    expect(c.modelValue.value[0].x).toBeGreaterThan(51)
    expect(c.modelValue.value[0].y).toBeGreaterThan(51)
  })

  it('resizes an existing active region from its corner handle', async () => {
    const c = setup([box()])
    c.onPointerDown(pe(60, 60))
    c.onCanvasPointerMove(pe(80, 80))
    c.onDocPointerUp(pe(80, 80))
    await flush()
    expect(c.modelValue.value[0].width).toBeGreaterThan(256)
    expect(c.modelValue.value[0].height).toBeGreaterThan(256)
  })

  it('keeps selection valid when Alt-clicking overlapping regions', async () => {
    const c = setup([
      box(),
      box({
        metadata: {
          type: 'obj',
          text: '',
          desc: 'second',
          palette: ['#ff0000']
        }
      })
    ])

    c.onPointerDown(pe(30, 30, { altKey: true }))
    c.onDocPointerUp(pe(30, 30))
    await flush()

    expect(c.activeRegion.value).not.toBeNull()
    expect(c.modelValue.value).toHaveLength(2)
  })

  it('ignores document movement and pointer up when no draw is active', async () => {
    const c = setup([box()])

    c.onCanvasPointerMove(pe(5, 95))
    c.onDocPointerUp(pe(95, 95))
    await flush()

    expect(c.modelValue.value).toHaveLength(1)
  })

  it('uses zero pointer coordinates when the canvas is unavailable', async () => {
    const c = setup()
    c.canvasEl.value = null

    c.onPointerDown(pe(50, 50))
    c.onCanvasPointerMove(pe(80, 80))
    c.onDocPointerUp(pe(80, 80))
    await flush()

    expect(c.modelValue.value).toHaveLength(0)
  })

  it('redraws active text regions with the fallback palette color', async () => {
    const fillStyles: string[] = []
    const fillText = vi.fn()
    const recordingCtx: unknown = {
      measureText: (s: string) => ({ width: s.length * 7 }),
      setTransform: () => {},
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      fillText,
      drawImage: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
      font: '',
      strokeStyle: '',
      lineWidth: 0,
      set fillStyle(value: string) {
        fillStyles.push(value)
      },
      get fillStyle() {
        return fillStyles.at(-1) ?? ''
      }
    }
    const c = setup([
      box({
        x: 10,
        y: 10,
        width: 30,
        height: 30,
        metadata: {
          type: 'text',
          text: 'hello',
          desc: 'alpha   beta\n\ncharlie',
          palette: []
        }
      })
    ])
    c.canvasEl.value = makeCanvas({
      context: recordingCtx as CanvasRenderingContext2D
    })

    c.focused.value = true
    c.syncState()
    await flush()

    expect(fillText).toHaveBeenCalled()
    expect(fillStyles.some((s) => s.includes('#8c8c8c'))).toBe(true)
  })

  it('draws safely when the canvas context is unavailable', async () => {
    const c = setup([box()])
    c.canvasEl.value = makeCanvas({ context: null })

    c.syncState()
    await flush()

    expect(c.modelValue.value).toHaveLength(1)
  })
})

describe('useBoundingBoxes region editing', () => {
  it('changes the active region type', async () => {
    const c = setup([box()])
    c.setActiveType('text')
    await flush()
    expect(c.modelValue.value[0].metadata.type).toBe('text')
  })

  it('deletes the active region on Delete', async () => {
    const c = setup([box()])
    c.onCanvasKeyDown(
      fromPartial<KeyboardEvent>({
        key: 'Delete',
        preventDefault: () => {},
        stopPropagation: () => {}
      })
    )
    await flush()
    expect(c.modelValue.value).toHaveLength(0)
  })

  it('clears all regions', async () => {
    const c = setup([box(), box({ x: 0 })])
    c.clearAll()
    await flush()
    expect(c.modelValue.value).toHaveLength(0)
  })

  it('does nothing when changing type without an active region', async () => {
    const c = setup()
    c.setActiveType('text')
    await flush()
    expect(c.modelValue.value).toHaveLength(0)
  })

  it('deletes the active region on Backspace', async () => {
    const c = setup([box()])
    c.onCanvasKeyDown(
      fromPartial<KeyboardEvent>({
        key: 'Backspace',
        preventDefault: () => {},
        stopPropagation: () => {}
      })
    )
    await flush()
    expect(c.modelValue.value).toHaveLength(0)
  })

  it('ignores unrelated keys and key events while drawing', async () => {
    const c = setup([box()])
    c.onCanvasKeyDown(
      fromPartial<KeyboardEvent>({
        key: 'Enter',
        preventDefault: () => {
          throw new Error('should not prevent')
        },
        stopPropagation: () => {}
      })
    )
    c.onPointerDown(pe(80, 80))
    c.onCanvasKeyDown(
      fromPartial<KeyboardEvent>({
        key: 'Delete',
        preventDefault: () => {
          throw new Error('should not prevent while drawing')
        },
        stopPropagation: () => {}
      })
    )
    c.onDocPointerUp(pe(80, 80))
    await flush()
    expect(c.modelValue.value).toHaveLength(1)
  })

  it('keeps a remaining region selected after deleting from a multi-region list', async () => {
    const c = setup([box(), box({ x: 10 })])

    c.onCanvasKeyDown(
      fromPartial<KeyboardEvent>({
        key: 'Delete',
        preventDefault: () => {},
        stopPropagation: () => {}
      })
    )
    await flush()

    expect(c.modelValue.value).toHaveLength(1)
    expect(c.activeRegion.value).not.toBeNull()
  })
})

describe('useBoundingBoxes inline editor', () => {
  it('opens on double click and commits the description', async () => {
    const c = setup([box()])
    c.onDoubleClick(pe(30, 30) as MouseEvent)
    await flush()
    expect(c.inlineEditor.value).not.toBeNull()

    c.inlineEditor.value!.value = 'a label'
    c.commitInlineEditor()
    await flush()
    expect(c.modelValue.value[0].metadata.desc).toBe('a label')
    expect(c.inlineEditor.value).toBeNull()
  })

  it('closes the inline editor on Escape', async () => {
    const c = setup([box()])
    c.onDoubleClick(pe(30, 30) as MouseEvent)
    await flush()
    c.onInlineKeyDown({ key: 'Escape' } as KeyboardEvent)
    expect(c.inlineEditor.value).toBeNull()
  })

  it('commits the inline editor on Ctrl+Enter', async () => {
    const c = setup([box()])
    c.onDoubleClick(pe(30, 30) as MouseEvent)
    await flush()
    c.inlineEditor.value!.value = 'committed'
    c.onInlineKeyDown({
      key: 'Enter',
      ctrlKey: true,
      metaKey: false
    } as KeyboardEvent)
    await flush()
    expect(c.modelValue.value[0].metadata.desc).toBe('committed')
  })

  it('commits the inline editor on Meta+Enter', async () => {
    const c = setup([box()])
    c.onDoubleClick(pe(30, 30) as MouseEvent)
    await flush()
    c.inlineEditor.value!.value = 'meta committed'
    c.onInlineKeyDown({
      key: 'Enter',
      ctrlKey: false,
      metaKey: true
    } as KeyboardEvent)
    await flush()
    expect(c.modelValue.value[0].metadata.desc).toBe('meta committed')
  })

  it('ignores Enter without a modifier in the inline editor', async () => {
    const c = setup([box()])
    c.onDoubleClick(pe(30, 30) as MouseEvent)
    await flush()
    c.inlineEditor.value!.value = 'not committed'
    c.onInlineKeyDown({
      key: 'Enter',
      ctrlKey: false,
      metaKey: false
    } as KeyboardEvent)
    await flush()
    expect(c.modelValue.value[0].metadata.desc).toBe('')
  })

  it('leaves state unchanged when committing without an editor', async () => {
    const c = setup([box()])
    c.commitInlineEditor()
    await flush()
    expect(c.modelValue.value[0].metadata.desc).toBe('')
  })

  it('closes a stale inline editor after its region was removed', async () => {
    const c = setup([box()])
    c.onDoubleClick(pe(30, 30) as MouseEvent)
    await flush()
    c.inlineEditor.value!.value = 'stale'

    c.clearAll()
    c.commitInlineEditor()
    await flush()

    expect(c.inlineEditor.value).toBeNull()
    expect(c.modelValue.value).toHaveLength(0)
  })

  it('does not open the inline editor when double-clicking empty space', async () => {
    const c = setup([box({ x: 0, y: 0, width: 50, height: 50 })])
    c.onDoubleClick(pe(95, 95) as MouseEvent)
    await flush()
    expect(c.inlineEditor.value).toBeNull()
  })

  it('uses zero mouse coordinates when double-clicking without a canvas', async () => {
    const c = setup([box({ x: 0, y: 0, width: 512, height: 512 })])
    c.canvasEl.value = null

    c.onDoubleClick(pe(30, 30) as MouseEvent)
    await flush()

    expect(c.inlineEditor.value).not.toBeNull()
  })
})

describe('useBoundingBoxes hover cursor', () => {
  it('switches to a pointer cursor over a tag', async () => {
    const c = setup([box({ x: 10, y: 10, width: 256, height: 256 })])
    expect(c.canvasCursor.value).toBe('crosshair')
    c.onCanvasPointerMove(pe(15, 15))
    await flush()
    expect(c.canvasCursor.value).toBe('pointer')
  })

  it('returns to the default cursor after leaving the canvas', async () => {
    const c = setup([box({ x: 10, y: 10, width: 256, height: 256 })])
    c.onCanvasPointerMove(pe(15, 15))
    await flush()
    c.onPointerLeave()
    await flush()
    expect(c.canvasCursor.value).toBe('crosshair')
  })

  it('does nothing when leaving without hover state', async () => {
    const c = setup([box()])
    c.onPointerLeave()
    await flush()
    expect(c.canvasCursor.value).toBe('crosshair')
  })

  it('keeps cursor default when canvas context is unavailable for title hit testing', async () => {
    const c = setup([box()])
    c.canvasEl.value = makeCanvas({ context: null })
    c.onCanvasPointerMove(pe(30, 30))
    await flush()
    expect(c.canvasCursor.value).toBe('crosshair')
  })

  it('keeps hover state unchanged when pointer movement hits the same tag', async () => {
    const c = setup([box({ x: 10, y: 10, width: 256, height: 256 })])

    c.onCanvasPointerMove(pe(15, 15))
    await flush()
    c.onCanvasPointerMove(pe(15, 15))
    await flush()

    expect(c.canvasCursor.value).toBe('pointer')
  })
})

describe('useBoundingBoxes background image', () => {
  it('loads a background image and snaps node dimensions', async () => {
    const widthCallback = vi.fn()
    const heightCallback = vi.fn()
    const inputNode = { id: 2 }
    appState.node = {
      widgets: [
        { name: 'width', value: 512, callback: widthCallback },
        { name: 'height', value: 512, callback: heightCallback }
      ],
      findInputSlot: () => 0,
      getInputNode: () => inputNode
    }
    const store = useNodeOutputStore()
    vi.spyOn(store, 'getNodeImageUrls').mockReturnValue(['blob:bg'])
    class FakeImage {
      crossOrigin = ''
      naturalWidth = 257
      naturalHeight = 271
      onload: (() => void) | null = null

      set src(_value: string) {
        this.onload?.()
      }
    }
    vi.stubGlobal('Image', FakeImage)

    setup([box()])
    await flush()

    expect(widthCallback).toHaveBeenCalledWith(256)
    expect(heightCallback).toHaveBeenCalledWith(272)
  })
})
