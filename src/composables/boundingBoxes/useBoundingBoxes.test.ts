import { render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref, ShallowRef } from 'vue'
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'

import { useBoundingBoxes } from './useBoundingBoxes'
import type { BoundingBox } from '@/types/boundingBoxes'

const { appState, outputState } = vi.hoisted(() => ({
  appState: { node: null as unknown },
  outputState: {
    outputs: undefined as unknown,
    nodeOutputs: null as { value: Record<string, unknown> } | null
  }
}))

vi.mock('@/scripts/app', () => ({
  app: { canvas: { graph: { getNodeById: () => appState.node } } }
}))

vi.mock('@/stores/nodeOutputStore', async () => {
  const { ref } = await import('vue')
  const nodeOutputs = ref<Record<string, unknown>>({})
  outputState.nodeOutputs = nodeOutputs
  return {
    useNodeOutputStore: () => ({
      nodeOutputs,
      nodePreviewImages: ref({}),
      getNodeImageUrls: () => undefined,
      getNodeOutputs: () => outputState.outputs
    })
  }
})

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
  moveTo: () => {},
  arc: () => {},
  fill: () => {},
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

interface MockNode {
  widgets: { name: string; value: unknown }[]
  findInputSlot: (name: string) => number
  getInputNode: () => null
  isInputConnected?: () => boolean
}

function makeNode(): MockNode {
  return {
    widgets: [
      { name: 'width', value: 512 },
      { name: 'height', value: 512 },
      { name: 'last_incoming', value: [] }
    ],
    findInputSlot: () => -1,
    getInputNode: () => null
  }
}

const lastIncomingOf = (node: MockNode) =>
  node.widgets.find((w) => w.name === 'last_incoming')!.value

const setLastIncomingOf = (node: MockNode, value: BoundingBox[]) => {
  node.widgets.find((w) => w.name === 'last_incoming')!.value = value
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

const modelBoxes = (c: Captured) => c.modelValue.value

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

function makeConnectedNode(): MockNode {
  return {
    ...makeNode(),
    findInputSlot: (name: string) => (name === 'bboxes' ? 1 : -1),
    isInputConnected: () => true
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  appState.node = makeNode()
  outputState.outputs = undefined
  if (outputState.nodeOutputs) outputState.nodeOutputs.value = {}
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
    expect(modelBoxes(c)).toHaveLength(1)
    expect(modelBoxes(c)[0].width).toBeGreaterThan(0)
  })

  it('discards a zero-size draw', async () => {
    const c = setup()
    c.onPointerDown(pe(10, 10))
    c.onDocPointerUp(pe(10, 10))
    await flush()
    expect(modelBoxes(c)).toHaveLength(0)
  })

  it('selects an existing region instead of drawing when clicking inside it', async () => {
    const c = setup([box()])
    c.onPointerDown(pe(30, 30))
    c.onDocPointerUp(pe(30, 30))
    await flush()
    expect(modelBoxes(c)).toHaveLength(1)
  })
})

describe('useBoundingBoxes region editing', () => {
  it('changes the active region type', async () => {
    const c = setup([box()])
    c.setActiveType('text')
    await flush()
    expect(modelBoxes(c)[0].metadata.type).toBe('text')
  })

  it('deletes the active region on Delete', async () => {
    const c = setup([box()])
    c.onCanvasKeyDown({
      key: 'Delete',
      preventDefault: () => {},
      stopPropagation: () => {}
    } as unknown as KeyboardEvent)
    await flush()
    expect(modelBoxes(c)).toHaveLength(0)
  })

  it('clears all regions and invalidates the applied upstream input', async () => {
    const node = makeNode()
    setLastIncomingOf(node, [box()])
    appState.node = node
    const c = setup([box(), box({ x: 0 })])
    c.clearAll()
    await flush()
    expect(modelBoxes(c)).toHaveLength(0)
    expect(lastIncomingOf(node)).toEqual([])
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
    expect(modelBoxes(c)[0].metadata.desc).toBe('a label')
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

describe('useBoundingBoxes incoming bboxes input', () => {
  it('adopts cached outputs on mount without overwriting existing edits', () => {
    const node = makeConnectedNode()
    appState.node = node
    const incoming = [box({ x: 0, width: 100 })]
    outputState.outputs = { input_bboxes: incoming }
    const c = setup([box({ x: 200, width: 300 })])
    expect(modelBoxes(c)).toHaveLength(1)
    expect(modelBoxes(c)[0].width).toBe(300)
    expect(lastIncomingOf(node)).toEqual(incoming)
  })

  it('does not re-apply an already applied output after a remount', async () => {
    const node = makeConnectedNode()
    const incoming = [box({ x: 0, width: 100 })]
    setLastIncomingOf(node, incoming)
    appState.node = node
    outputState.outputs = { input_bboxes: incoming }
    const c = setup([box({ x: 200, width: 300 })])
    outputState.nodeOutputs!.value = { updated: true }
    await flush()
    expect(modelBoxes(c)[0].width).toBe(300)
  })

  it('ignores incoming output when the input is not connected', () => {
    outputState.outputs = { input_bboxes: [box({ x: 0, width: 100 })] }
    const c = setup([])
    expect(modelBoxes(c)).toHaveLength(0)
  })

  it('repopulates from the next run after clearing the canvas', async () => {
    appState.node = makeConnectedNode()
    const c = setup([])

    outputState.outputs = { input_bboxes: [box({ x: 0, width: 100 })] }
    outputState.nodeOutputs!.value = { n: 1 }
    await flush()
    expect(modelBoxes(c)).toHaveLength(1)

    c.clearAll()
    await flush()
    expect(modelBoxes(c)).toHaveLength(0)

    outputState.nodeOutputs!.value = { n: 2 }
    await flush()
    expect(modelBoxes(c)).toHaveLength(1)
    expect(modelBoxes(c)[0].width).toBe(100)
  })

  it('does not apply output updates while the input is disconnected', async () => {
    let connected = true
    appState.node = {
      ...makeConnectedNode(),
      isInputConnected: () => connected
    }
    const c = setup([])

    outputState.outputs = { input_bboxes: [box({ x: 0, width: 100 })] }
    outputState.nodeOutputs!.value = { n: 1 }
    await flush()
    expect(modelBoxes(c)).toHaveLength(1)

    c.clearAll()
    await flush()
    connected = false
    outputState.nodeOutputs!.value = { n: 2 }
    await flush()
    expect(modelBoxes(c)).toHaveLength(0)
  })

  it('does not apply incoming boxes while the user is drawing', async () => {
    appState.node = makeConnectedNode()
    const c = setup([])
    c.grid.value = false
    c.onPointerDown(pe(10, 10))
    c.onCanvasPointerMove(pe(50, 50))

    outputState.outputs = {
      input_bboxes: [box({ x: 0, width: 100, height: 100 })]
    }
    outputState.nodeOutputs!.value = { n: 1 }
    await flush()

    c.onDocPointerUp(pe(50, 50))
    await flush()
    expect(modelBoxes(c)).toHaveLength(1)
    expect(modelBoxes(c)[0].width).toBe(205)
  })

  it('applies incoming boxes when outputs stream in after mount', async () => {
    const node = makeConnectedNode()
    appState.node = node
    const c = setup([])
    expect(modelBoxes(c)).toHaveLength(0)

    const incoming = [box({ x: 0, width: 100 })]
    outputState.outputs = { input_bboxes: incoming }
    outputState.nodeOutputs!.value = { updated: true }
    await flush()

    expect(modelBoxes(c)).toHaveLength(1)
    expect(modelBoxes(c)[0].width).toBe(100)
    expect(lastIncomingOf(node)).toEqual(incoming)
  })

  it('re-seeds the canvas over user edits when the upstream value changes', async () => {
    const node = makeConnectedNode()
    setLastIncomingOf(node, [box({ x: 0, width: 100 })])
    appState.node = node
    const c = setup([box({ x: 200, width: 300 })])

    const changed = [box({ x: 64, width: 128 })]
    outputState.outputs = { input_bboxes: changed }
    outputState.nodeOutputs!.value = { n: 1 }
    await flush()

    expect(modelBoxes(c)[0].width).toBe(128)
    expect(lastIncomingOf(node)).toEqual(changed)
  })
})

describe('useBoundingBoxes grid snapping', () => {
  it('snaps a drawn box to the grid when grid is enabled (default)', async () => {
    const c = setup()
    c.onPointerDown(pe(10, 10))
    c.onCanvasPointerMove(pe(60, 60))
    c.onDocPointerUp(pe(60, 60))
    await flush()
    expect(modelBoxes(c)).toHaveLength(1)
    expect(modelBoxes(c)[0].x).toBe(64)
    expect(modelBoxes(c)[0].width).toBe(256)
  })

  it('does not snap when grid is disabled', async () => {
    const c = setup()
    c.grid.value = false
    c.onPointerDown(pe(10, 10))
    c.onCanvasPointerMove(pe(55, 55))
    c.onDocPointerUp(pe(55, 55))
    await flush()
    expect(modelBoxes(c)[0].width).toBe(230)
  })

  it('keeps the anchored edge fixed when resizing a single edge', async () => {
    const c = setup([box({ x: 51, y: 51, width: 256, height: 256 })])
    c.onPointerDown(pe(60, 30))
    c.onCanvasPointerMove(pe(80, 30))
    c.onDocPointerUp(pe(80, 30))
    await flush()
    expect(modelBoxes(c)[0].x).toBe(51)
  })

  it('removes a box that a resize collapses to zero size', async () => {
    const c = setup([box({ x: 64, y: 64, width: 128, height: 128 })])
    c.onPointerDown(pe(37, 25))
    c.onCanvasPointerMove(pe(14, 25))
    c.onDocPointerUp(pe(14, 25))
    await flush()
    expect(modelBoxes(c)).toHaveLength(0)
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
