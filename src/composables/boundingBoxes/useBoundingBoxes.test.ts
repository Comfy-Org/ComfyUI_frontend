import { render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref, ShallowRef } from 'vue'
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'

import { useBoundingBoxes } from './useBoundingBoxes'
import type { BoundingBox } from '@/types/boundingBoxes'

const { appState } = vi.hoisted(() => ({
  appState: { node: null as unknown }
}))

vi.mock('@/scripts/app', () => ({
  app: { canvas: { graph: { getNodeById: () => appState.node } } }
}))

const ctx = {
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
} as unknown as CanvasRenderingContext2D

function makeCanvas(): HTMLCanvasElement {
  const el = document.createElement('canvas')
  Object.defineProperty(el, 'clientWidth', { value: 100, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true })
  el.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
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
  ({
    button: 0,
    clientX,
    clientY,
    altKey: false,
    pointerId: 1,
    preventDefault: () => {},
    stopPropagation: () => {},
    ...over
  }) as unknown as PointerEvent

const flush = async () => {
  await Promise.resolve()
  await nextTick()
}

type Api = ReturnType<typeof useBoundingBoxes>
interface Captured extends Api {
  canvasEl: ShallowRef<HTMLCanvasElement | null>
  modelValue: Ref<BoundingBox[]>
}

function setup(initial: BoundingBox[] = []) {
  let captured: Captured | undefined
  const Harness = defineComponent({
    setup() {
      const canvasEl = shallowRef<HTMLCanvasElement | null>(null)
      const canvasContainer = shallowRef<HTMLDivElement | null>(null)
      const inlineEditorEl = shallowRef<HTMLTextAreaElement | null>(null)
      const modelValue = ref(initial)
      const api = useBoundingBoxes('1', {
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
})

describe('useBoundingBoxes drawing', () => {
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
    c.onCanvasKeyDown({
      key: 'Delete',
      preventDefault: () => {},
      stopPropagation: () => {}
    } as unknown as KeyboardEvent)
    await flush()
    expect(c.modelValue.value).toHaveLength(0)
  })

  it('clears all regions', async () => {
    const c = setup([box(), box({ x: 0 })])
    c.clearAll()
    await flush()
    expect(c.modelValue.value).toHaveLength(0)
  })
})

describe('useBoundingBoxes inline editor', () => {
  it('opens on double click and commits the description', async () => {
    const c = setup([box()])
    c.onDoubleClick(pe(30, 30) as unknown as MouseEvent)
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
    c.onDoubleClick(pe(30, 30) as unknown as MouseEvent)
    await flush()
    c.onInlineKeyDown({ key: 'Escape' } as KeyboardEvent)
    expect(c.inlineEditor.value).toBeNull()
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
})
