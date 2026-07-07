import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { createApp, defineComponent, nextTick, reactive, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import WidgetImageCrop from '@/components/imagecrop/WidgetImageCrop.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import {
  createMockLGraphNode,
  createMockSubgraphNode
} from '@/utils/__tests__/litegraphTestUtils'

import { imageCropLoadingAfterUrlChange, useImageCrop } from './useImageCrop'

const resizeObserverCallbacks: Array<() => void> = []

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual('@vueuse/core')
  return {
    ...(actual as Record<string, unknown>),
    useResizeObserver: (_target: unknown, cb: () => void) => {
      resizeObserverCallbacks.push(cb)
      return { stop: vi.fn() }
    }
  }
})

const mockResolveNode = vi.hoisted(() =>
  vi.fn<(id: NodeId) => LGraphNode | null>()
)
vi.mock('@/utils/litegraphUtil', () => ({
  resolveNode: (id: NodeId) => mockResolveNode(id)
}))

const mockGetNodeImageUrls = vi.hoisted(() =>
  vi.fn<(node: LGraphNode) => string[] | null | undefined>()
)

type MockOutputStore = {
  nodeOutputs: Record<string, unknown>
  nodePreviewImages: Record<string, unknown>
  getNodeImageUrls: typeof mockGetNodeImageUrls
}

const useNodeOutputStoreMock = vi.hoisted(() => vi.fn<() => MockOutputStore>())

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => useNodeOutputStoreMock()
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: {
      graph: {
        rootGraph: { id: 'test-graph' }
      }
    }
  })
}))

vi.mock('@/stores/widgetValueStore', () => ({
  useWidgetValueStore: () => ({
    getNodeWidgets: vi.fn(() => [])
  })
}))

const ImageCropHarness = defineComponent({
  name: 'ImageCropHarness',
  props: {
    nodeId: { type: Number, default: 2 }
  },
  setup(props) {
    const modelValue = ref({ x: 40, y: 40, width: 160, height: 120 })
    const imageEl = ref<HTMLImageElement | null>(null)
    const containerEl = ref<HTMLDivElement | null>(null)
    return {
      modelValue,
      imageEl,
      containerEl,
      ...useImageCrop(toNodeId(props.nodeId), {
        imageEl,
        containerEl,
        modelValue
      })
    }
  },
  template: `
    <div
      ref="containerEl"
      style="width:400px;height:300px;position:relative;overflow:hidden"
    >
      <img v-if="imageUrl" ref="imageEl" :src="imageUrl" alt="" />
    </div>
  `
})

function flushResizeObservers() {
  for (const cb of [...resizeObserverCallbacks]) {
    cb()
  }
}

function mountContainerLayout(
  el: HTMLElement,
  width: number,
  height: number,
  rectWidth = width
) {
  Object.defineProperty(el, 'clientWidth', {
    configurable: true,
    value: width
  })
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    value: height
  })
  el.getBoundingClientRect = () =>
    ({
      width: rectWidth,
      height,
      top: 0,
      left: 0,
      right: rectWidth,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({})
    }) as DOMRect
}

function makePointerEvent(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  target: EventTarget,
  clientX: number,
  clientY: number
) {
  const ev = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    clientX,
    clientY
  })
  Object.defineProperty(ev, 'target', {
    configurable: true,
    enumerable: true,
    value: target
  })
  return ev
}

type CropVm = Record<string, unknown> & {
  $el: HTMLDivElement
  modelValue: { x: number; y: number; width: number; height: number }
}

function setupImageLayout(vm: CropVm, nw: number, nh: number) {
  /* Harness root + image are not RTL queries — layout is driven by composable state */
  /* eslint-disable testing-library/no-node-access */
  const container = vm.$el as HTMLDivElement
  const img = container.querySelector('img')
  /* eslint-enable testing-library/no-node-access */
  mountContainerLayout(container, 400, 300)
  if (img) {
    Object.defineProperty(img, 'naturalWidth', {
      configurable: true,
      value: nw
    })
    Object.defineProperty(img, 'naturalHeight', {
      configurable: true,
      value: nh
    })
  }
  ;(vm.handleImageLoad as () => void)()
  flushResizeObservers()
}

const harnessCleanups: Array<() => void> = []

async function mountHarness(nodeId: NodeId = toNodeId(2)) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp(ImageCropHarness, { nodeId: Number(nodeId) })
  const mounted: unknown = app.mount(el)
  const vm = mounted as CropVm
  await nextTick()
  await Promise.resolve()
  harnessCleanups.push(() => {
    app.unmount()
    el.remove()
  })
  return vm
}

async function flushTicks() {
  await Promise.resolve()
  await nextTick()
}

describe('imageCropLoadingAfterUrlChange', () => {
  it('clears loading when url becomes null', () => {
    expect(imageCropLoadingAfterUrlChange(null, 'https://a/b.png')).toBe(false)
  })

  it('keeps loading off when url stays null', () => {
    expect(imageCropLoadingAfterUrlChange(null, null)).toBe(false)
  })

  it('starts loading when url changes to a new string', () => {
    expect(imageCropLoadingAfterUrlChange('https://b', 'https://a')).toBe(true)
  })

  it('starts loading when first url is set', () => {
    expect(imageCropLoadingAfterUrlChange('https://a', undefined)).toBe(true)
  })

  it('returns null when url is unchanged so caller can skip updating', () => {
    expect(imageCropLoadingAfterUrlChange('https://a', 'https://a')).toBe(null)
  })
})

describe('useImageCrop', () => {
  let sourceNode: LGraphNode
  let cropNode: LGraphNode
  let outputStore: MockOutputStore

  beforeEach(() => {
    resizeObserverCallbacks.length = 0
    vi.clearAllMocks()
    outputStore = {
      nodeOutputs: reactive<Record<string, unknown>>({}),
      nodePreviewImages: reactive<Record<string, unknown>>({}),
      getNodeImageUrls: mockGetNodeImageUrls
    }
    useNodeOutputStoreMock.mockReturnValue(outputStore)
    sourceNode = createMockLGraphNode({
      id: 99,
      isSubgraphNode: () => false
    })
    cropNode = createMockLGraphNode({
      id: 2,
      getInputNode: vi.fn(() => sourceNode),
      getInputLink: vi.fn(() => ({ origin_slot: 0 })),
      isSubgraphNode: () => false
    })
    mockResolveNode.mockReturnValue(cropNode)
    mockGetNodeImageUrls.mockImplementation((n) =>
      n === sourceNode ? ['https://example.com/a.png'] : null
    )
    setActivePinia(createTestingPinia({ stubActions: true }))
  })

  afterEach(() => {
    for (const c of harnessCleanups) {
      c()
    }
    harnessCleanups.length = 0
  })

  it('resolves image URL from the connected input node after mount', async () => {
    const vm = await mountHarness()
    expect(vm.imageUrl).toBe('https://example.com/a.png')
  })

  it('returns null image URL when the graph node cannot be resolved', async () => {
    mockResolveNode.mockReturnValue(null)
    const vm = await mountHarness()
    expect(vm.imageUrl).toBeNull()
  })

  it('returns null image URL when there is no input node', async () => {
    const alone = createMockLGraphNode({
      id: 2,
      getInputNode: vi.fn(() => null),
      getInputLink: vi.fn(),
      isSubgraphNode: () => false
    })
    mockResolveNode.mockReturnValue(alone)
    const vm = await mountHarness()
    expect(vm.imageUrl).toBeNull()
  })

  it('returns null when subgraph link is missing', async () => {
    const subgraphInput = createMockSubgraphNode([], {
      id: 40,
      resolveSubgraphOutputLink: vi.fn(() => ({ outputNode: null }))
    })
    const sgCrop = createMockLGraphNode({
      id: 2,
      getInputNode: vi.fn(() => subgraphInput),
      getInputLink: vi.fn(() => null),
      isSubgraphNode: () => false
    })
    mockResolveNode.mockReturnValue(sgCrop)
    const vm = await mountHarness()
    expect(vm.imageUrl).toBeNull()
  })

  it('returns null when a subgraph output link cannot be resolved', async () => {
    const subgraphInput = createMockSubgraphNode([], {
      id: 40,
      resolveSubgraphOutputLink: vi.fn(() => undefined)
    })
    const sgCrop = createMockLGraphNode({
      id: 2,
      getInputNode: vi.fn(() => subgraphInput),
      getInputLink: vi.fn(() => ({ origin_slot: 0 })),
      isSubgraphNode: () => false
    })
    mockResolveNode.mockReturnValue(sgCrop)
    const vm = await mountHarness()
    expect(vm.imageUrl).toBeNull()
  })

  it('returns null when the source node has no image URLs', async () => {
    mockGetNodeImageUrls.mockImplementation((n) =>
      n === sourceNode ? [] : null
    )

    const vm = await mountHarness()

    expect(vm.imageUrl).toBeNull()
  })

  it('resolves image through a subgraph input node', async () => {
    const innerSource = createMockLGraphNode({
      id: 50,
      isSubgraphNode: () => false
    })
    const subgraphInput = createMockSubgraphNode([], {
      id: 40,
      resolveSubgraphOutputLink: vi.fn(() => ({ outputNode: innerSource }))
    })

    const sgCrop = createMockLGraphNode({
      id: 2,
      getInputNode: vi.fn(() => subgraphInput),
      getInputLink: vi.fn(() => ({ origin_slot: 0 })),
      isSubgraphNode: () => false
    })
    mockResolveNode.mockReturnValue(sgCrop)
    mockGetNodeImageUrls.mockImplementation((n) =>
      n === innerSource ? ['https://subgraph.png'] : null
    )

    const vm = await mountHarness()
    expect(vm.imageUrl).toBe('https://subgraph.png')
  })

  it('updates imageUrl when nodeOutputs change', async () => {
    const vm = await mountHarness()
    expect(vm.imageUrl).toBe('https://example.com/a.png')

    mockGetNodeImageUrls.mockImplementation((n) =>
      n === sourceNode ? ['https://example.com/b.png'] : null
    )
    outputStore.nodeOutputs['touch'] = { updated: true }

    await flushTicks()
    expect(vm.imageUrl).toBe('https://example.com/b.png')
  })

  it('keeps loading unchanged when output updates keep the same URL', async () => {
    const vm = await mountHarness()
    ;(vm.handleImageLoad as () => void)()
    expect(vm.isLoading).toBe(false)

    outputStore.nodeOutputs['touch'] = { updated: true }

    await flushTicks()
    expect(vm.imageUrl).toBe('https://example.com/a.png')
    expect(vm.isLoading).toBe(false)
  })

  it('updates imageUrl when nodePreviewImages change', async () => {
    let url = 'https://example.com/a.png'
    mockGetNodeImageUrls.mockImplementation((n) =>
      n === sourceNode ? [url] : null
    )
    const vm = await mountHarness()
    expect(vm.imageUrl).toBe('https://example.com/a.png')
    url = 'https://example.com/preview.png'
    outputStore.nodePreviewImages['rev'] = []
    await flushTicks()
    expect(vm.imageUrl).toBe('https://example.com/preview.png')
  })

  it('computes letterboxed display metrics for a wide image', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 800, 200)
    vm.modelValue = { x: 0, y: 0, width: 400, height: 200 }
    const style = vm.cropBoxStyle as Record<string, string>
    expect(parseFloat(style.top)).toBeGreaterThan(20)
    expect(parseFloat(style.left)).toBeLessThanOrEqual(2)
  })

  it('computes pillarboxed display metrics for a tall image', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 200, 800)
    vm.modelValue = { x: 0, y: 0, width: 100, height: 400 }
    const style = vm.cropBoxStyle as Record<string, string>
    expect(parseFloat(style.left)).toBeGreaterThan(20)
    expect(parseFloat(style.top)).toBeLessThanOrEqual(2)
  })

  it('uses scale factor 1 when natural dimensions are zero', async () => {
    const vm = await mountHarness()
    /* eslint-disable testing-library/no-node-access */
    const container = vm.$el as HTMLDivElement
    const img = container.querySelector('img')
    /* eslint-enable testing-library/no-node-access */
    if (!img) throw new Error('expected preview img')
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 0 })
    Object.defineProperty(img, 'naturalHeight', {
      configurable: true,
      value: 0
    })
    ;(vm.handleImageLoad as () => void)()
    vm.modelValue = { x: 0, y: 0, width: 100, height: 80 }
    const style = vm.cropBoxStyle as Record<string, string>
    expect(parseFloat(style.width)).toBeCloseTo(100, 1)
    expect(parseFloat(style.height)).toBeCloseTo(80, 1)
  })

  it('ignores resize observer callbacks before an image is rendered', async () => {
    mockGetNodeImageUrls.mockReturnValue(null)
    const vm = await mountHarness()

    flushResizeObservers()

    expect(vm.imageUrl).toBeNull()
    expect(vm.cropBoxStyle).toEqual({
      left: '38px',
      top: '38px',
      width: '160px',
      height: '120px'
    })
  })

  it('uses default crop dimensions when model dimensions are zero', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 400, 400)
    vm.modelValue = { x: 0, y: 0, width: 0, height: 0 }

    expect(vm.cropWidth).toBe(512)
    expect(vm.cropHeight).toBe(512)
  })

  it('exposes eight resize handles when unlocked and four when locked', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 400, 400)
    expect((vm.resizeHandles as { direction: string }[]).length).toBe(8)
    vm.isLockEnabled = true
    await nextTick()
    expect((vm.resizeHandles as unknown[]).length).toBe(4)
  })

  it('sets isLoading to true when imageUrl changes to a new URL, then clears on load', async () => {
    const vm = await mountHarness()
    expect(vm.imageUrl).toBe('https://example.com/a.png')

    mockGetNodeImageUrls.mockImplementation((n) =>
      n === sourceNode ? ['https://example.com/b.png'] : null
    )
    outputStore.nodeOutputs['touch'] = {}
    await flushTicks()

    expect(vm.imageUrl).toBe('https://example.com/b.png')
    expect(vm.isLoading).toBe(true)
    ;(vm.handleImageLoad as () => void)()
    expect(vm.isLoading).toBe(false)
  })

  it('clears imageUrl on image error', async () => {
    const vm = await mountHarness()
    expect(vm.imageUrl).toBeTruthy()
    ;(vm.handleImageError as () => void)()
    expect(vm.imageUrl).toBeNull()
    expect(vm.isLoading).toBe(false)
  })

  it('uses fallback scale when dragging before image dimensions are known', async () => {
    const vm = await mountHarness()
    vm.modelValue = { x: 10, y: 10, width: 120, height: 90 }
    const captureEl = document.createElement('div')
    captureEl.setPointerCapture = vi.fn()
    captureEl.releasePointerCapture = vi.fn()

    const dragStart = vm.handleDragStart as (e: PointerEvent) => void
    const dragMove = vm.handleDragMove as (e: PointerEvent) => void
    const dragEnd = vm.handleDragEnd as (e: PointerEvent) => void

    dragStart(makePointerEvent('pointerdown', captureEl, 10, 10))
    dragMove(makePointerEvent('pointermove', captureEl, 30, 30))
    dragEnd(makePointerEvent('pointerup', captureEl, 30, 30))

    expect(vm.modelValue.x).toBe(0)
    expect(vm.modelValue.y).toBe(0)
  })

  it('uses fallback scale when rendered container width is missing', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 400, 400)
    mountContainerLayout(vm.$el, 0, 300, 0)
    vm.modelValue = { x: 10, y: 10, width: 120, height: 90 }
    const captureEl = document.createElement('div')
    captureEl.setPointerCapture = vi.fn()
    captureEl.releasePointerCapture = vi.fn()

    const resizeStart = vm.handleResizeStart as (
      e: PointerEvent,
      dir: string
    ) => void
    const resizeMove = vm.handleResizeMove as (e: PointerEvent) => void
    const resizeEnd = vm.handleResizeEnd as (e: PointerEvent) => void

    resizeStart(makePointerEvent('pointerdown', captureEl, 130, 80), 'right')
    resizeMove(makePointerEvent('pointermove', captureEl, 150, 80))
    resizeEnd(makePointerEvent('pointerup', captureEl, 150, 80))

    expect(vm.modelValue.width).toBe(140)
  })

  it('does not start dragging when there is no image', async () => {
    mockGetNodeImageUrls.mockReturnValue(null)
    const vm = await mountHarness()
    expect(vm.imageUrl).toBeNull()
    const xBefore = vm.cropX as number
    const el = document.createElement('div')
    el.setPointerCapture = vi.fn()
    ;(vm.handleDragStart as (e: PointerEvent) => void)(
      makePointerEvent('pointerdown', el, 10, 10)
    )
    expect(vm.cropX as number).toBe(xBefore)
  })

  it('ignores drag move and end before dragging starts', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 400, 300)
    vm.modelValue = { x: 10, y: 10, width: 120, height: 90 }
    const releaseEl = document.createElement('div')
    releaseEl.releasePointerCapture = vi.fn()

    ;(vm.handleDragMove as (e: PointerEvent) => void)(
      makePointerEvent('pointermove', releaseEl, 260, 180)
    )
    ;(vm.handleDragEnd as (e: PointerEvent) => void)(
      makePointerEvent('pointerup', releaseEl, 260, 180)
    )

    expect(vm.modelValue).toEqual({ x: 10, y: 10, width: 120, height: 90 })
    expect(releaseEl.releasePointerCapture).not.toHaveBeenCalled()
  })

  it('drags without pointer capture when the event target is not an element', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 400, 300)
    vm.modelValue = { x: 10, y: 10, width: 120, height: 90 }

    const dragStart = vm.handleDragStart as (e: PointerEvent) => void
    const dragMove = vm.handleDragMove as (e: PointerEvent) => void
    const dragEnd = vm.handleDragEnd as (e: PointerEvent) => void

    dragStart(makePointerEvent('pointerdown', document, 200, 150))
    dragMove(makePointerEvent('pointermove', document, 260, 180))
    dragEnd(makePointerEvent('pointerup', document, 260, 180))

    expect(vm.modelValue.x).toBeGreaterThan(10)
    expect(vm.modelValue.y).toBeGreaterThan(10)
  })

  it('drags the crop box in image space and ends on pointerup', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 400, 300)
    mountContainerLayout(vm.$el as HTMLDivElement, 400, 300)
    vm.modelValue = { x: 10, y: 10, width: 120, height: 90 }

    const captureEl = document.createElement('div')
    captureEl.setPointerCapture = vi.fn()
    captureEl.releasePointerCapture = vi.fn()

    const dragStart = vm.handleDragStart as (e: PointerEvent) => void
    const dragMove = vm.handleDragMove as (e: PointerEvent) => void
    const dragEnd = vm.handleDragEnd as (e: PointerEvent) => void

    const x0 = vm.cropX as number
    dragStart(makePointerEvent('pointerdown', captureEl, 200, 150))
    dragMove(makePointerEvent('pointermove', captureEl, 260, 180))
    dragEnd(makePointerEvent('pointerup', captureEl, 260, 180))
    expect(vm.cropX as number).toBeGreaterThan(x0)
    expect(vm.cropY as number).toBeGreaterThanOrEqual(0)
  })

  it('resizes from the right edge without moving origin', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 500, 500)
    vm.modelValue = { x: 50, y: 50, width: 120, height: 100 }

    const captureEl = document.createElement('div')
    captureEl.setPointerCapture = vi.fn()
    captureEl.releasePointerCapture = vi.fn()

    const resizeStart = vm.handleResizeStart as (
      e: PointerEvent,
      dir: string
    ) => void
    const resizeMove = vm.handleResizeMove as (e: PointerEvent) => void
    const resizeEnd = vm.handleResizeEnd as (e: PointerEvent) => void

    resizeStart(makePointerEvent('pointerdown', captureEl, 200, 120), 'right')
    resizeMove(makePointerEvent('pointermove', captureEl, 260, 120))
    resizeEnd(makePointerEvent('pointerup', captureEl, 260, 120))

    expect(vm.modelValue.width).toBeGreaterThan(120)
    expect(vm.modelValue.x).toBe(50)
  })

  it('resizes from the top edge, moving y and shrinking height', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 500, 500)
    vm.modelValue = { x: 50, y: 100, width: 120, height: 200 }

    const captureEl = document.createElement('div')
    captureEl.setPointerCapture = vi.fn()
    captureEl.releasePointerCapture = vi.fn()

    const resizeStart = vm.handleResizeStart as (
      e: PointerEvent,
      dir: string
    ) => void
    const resizeMove = vm.handleResizeMove as (e: PointerEvent) => void
    const resizeEnd = vm.handleResizeEnd as (e: PointerEvent) => void

    resizeStart(makePointerEvent('pointerdown', captureEl, 100, 100), 'top')
    resizeMove(makePointerEvent('pointermove', captureEl, 100, 150))
    resizeEnd(makePointerEvent('pointerup', captureEl, 100, 150))

    expect(vm.modelValue.y).toBeGreaterThan(100)
    expect(vm.modelValue.height).toBeLessThan(200)
  })

  it('resizes from the left edge and clamps to the image origin', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 500, 500)
    vm.modelValue = { x: 50, y: 50, width: 120, height: 100 }

    const captureEl = document.createElement('div')
    captureEl.setPointerCapture = vi.fn()
    captureEl.releasePointerCapture = vi.fn()

    const resizeStart = vm.handleResizeStart as (
      e: PointerEvent,
      dir: string
    ) => void
    const resizeMove = vm.handleResizeMove as (e: PointerEvent) => void
    const resizeEnd = vm.handleResizeEnd as (e: PointerEvent) => void

    resizeStart(makePointerEvent('pointerdown', captureEl, 100, 120), 'left')
    resizeMove(makePointerEvent('pointermove', captureEl, -100, 120))
    resizeEnd(makePointerEvent('pointerup', captureEl, -100, 120))

    expect(vm.modelValue.x).toBe(0)
    expect(vm.modelValue.width).toBeGreaterThan(120)
  })

  it('ignores resize move and end before resizing starts', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 400, 400)
    vm.modelValue = { x: 40, y: 40, width: 120, height: 120 }
    const releaseEl = document.createElement('div')
    releaseEl.releasePointerCapture = vi.fn()

    ;(vm.handleResizeMove as (e: PointerEvent) => void)(
      makePointerEvent('pointermove', releaseEl, 360, 360)
    )
    ;(vm.handleResizeEnd as (e: PointerEvent) => void)(
      makePointerEvent('pointerup', releaseEl, 360, 360)
    )

    expect(vm.modelValue).toEqual({ x: 40, y: 40, width: 120, height: 120 })
    expect(releaseEl.releasePointerCapture).not.toHaveBeenCalled()
  })

  it('does not start resizing when there is no image', async () => {
    mockGetNodeImageUrls.mockReturnValue(null)
    const vm = await mountHarness()
    const captureEl = document.createElement('div')
    captureEl.setPointerCapture = vi.fn()

    ;(vm.handleResizeStart as (e: PointerEvent, dir: string) => void)(
      makePointerEvent('pointerdown', captureEl, 20, 20),
      'right'
    )

    expect(captureEl.setPointerCapture).not.toHaveBeenCalled()
  })

  it('applies a preset aspect ratio and clamps height to the image', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 800, 500)
    vm.modelValue = { x: 0, y: 400, width: 200, height: 100 }
    vm.selectedRatio = '9:16'
    expect(vm.modelValue.height).toBeLessThanOrEqual(100)
    expect(vm.modelValue.y + vm.modelValue.height).toBeLessThanOrEqual(500)
  })

  it('selecting custom clears locked ratio', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 400, 400)
    vm.selectedRatio = '1:1'
    expect(vm.isLockEnabled).toBe(true)
    vm.selectedRatio = 'custom'
    expect(vm.isLockEnabled).toBe(false)
  })

  it('ignores unknown aspect-ratio presets and unlocks explicit lock changes', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 400, 400)
    vm.modelValue = { x: 0, y: 0, width: 160, height: 120 }

    vm.selectedRatio = 'missing'
    expect(vm.selectedRatio).toBe('custom')
    expect(vm.isLockEnabled).toBe(false)

    vm.isLockEnabled = true
    expect(vm.selectedRatio).toBe('4:3')

    vm.isLockEnabled = true
    expect(vm.selectedRatio).toBe('4:3')

    vm.isLockEnabled = false
    expect(vm.selectedRatio).toBe('custom')
  })

  it('shows custom in the ratio label when lock does not match a preset', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 400, 400)
    vm.modelValue = { x: 0, y: 0, width: 300, height: 200 }
    vm.isLockEnabled = true
    await nextTick()
    expect(vm.selectedRatio).toBe('custom')
  })

  it('keeps aspect ratio when resizing a corner while locked', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 400, 400)
    vm.modelValue = { x: 40, y: 40, width: 120, height: 120 }
    vm.isLockEnabled = true
    const ratio = vm.modelValue.width / vm.modelValue.height

    const captureEl = document.createElement('div')
    captureEl.setPointerCapture = vi.fn()
    captureEl.releasePointerCapture = vi.fn()

    const resizeStart = vm.handleResizeStart as (
      e: PointerEvent,
      dir: string
    ) => void
    const resizeMove = vm.handleResizeMove as (e: PointerEvent) => void
    const resizeEnd = vm.handleResizeEnd as (e: PointerEvent) => void

    resizeStart(makePointerEvent('pointerdown', captureEl, 300, 300), 'se')
    resizeMove(makePointerEvent('pointermove', captureEl, 360, 360))
    resizeEnd(makePointerEvent('pointerup', captureEl, 360, 360))

    const r = vm.modelValue.width / vm.modelValue.height
    expect(Math.abs(r - ratio)).toBeLessThan(0.05)
  })

  it('clamps constrained corner resize to the image bottom edge', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 400, 400)
    vm.modelValue = { x: 300, y: 300, width: 80, height: 80 }
    vm.isLockEnabled = true

    const captureEl = document.createElement('div')
    captureEl.setPointerCapture = vi.fn()
    captureEl.releasePointerCapture = vi.fn()

    const resizeStart = vm.handleResizeStart as (
      e: PointerEvent,
      dir: string
    ) => void
    const resizeMove = vm.handleResizeMove as (e: PointerEvent) => void
    const resizeEnd = vm.handleResizeEnd as (e: PointerEvent) => void

    resizeStart(makePointerEvent('pointerdown', captureEl, 200, 200), 'se')
    resizeMove(makePointerEvent('pointermove', captureEl, 600, 600))
    resizeEnd(makePointerEvent('pointerup', captureEl, 600, 600))

    expect(vm.modelValue.y + vm.modelValue.height).toBeLessThanOrEqual(400)
  })

  it('clamps constrained north-west resize to the image top-left bounds', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 400, 400)
    vm.modelValue = { x: 20, y: 20, width: 80, height: 80 }
    vm.isLockEnabled = true

    const captureEl = document.createElement('div')
    captureEl.setPointerCapture = vi.fn()
    captureEl.releasePointerCapture = vi.fn()

    const resizeStart = vm.handleResizeStart as (
      e: PointerEvent,
      dir: string
    ) => void
    const resizeMove = vm.handleResizeMove as (e: PointerEvent) => void
    const resizeEnd = vm.handleResizeEnd as (e: PointerEvent) => void

    resizeStart(makePointerEvent('pointerdown', captureEl, 40, 40), 'nw')
    resizeMove(makePointerEvent('pointermove', captureEl, -200, -200))
    resizeEnd(makePointerEvent('pointerup', captureEl, -200, -200))

    expect(vm.modelValue.x).toBeGreaterThanOrEqual(0)
    expect(vm.modelValue.y).toBeGreaterThanOrEqual(0)
    expect(vm.modelValue.width).toBeGreaterThanOrEqual(16)
    expect(vm.modelValue.height).toBeGreaterThanOrEqual(16)
  })

  it('clamps constrained corner resize to minimum dimensions', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 400, 400)
    vm.modelValue = { x: 40, y: 40, width: 160, height: 80 }
    vm.isLockEnabled = true

    const captureEl = document.createElement('div')
    captureEl.setPointerCapture = vi.fn()
    captureEl.releasePointerCapture = vi.fn()

    const resizeStart = vm.handleResizeStart as (
      e: PointerEvent,
      dir: string
    ) => void
    const resizeMove = vm.handleResizeMove as (e: PointerEvent) => void
    const resizeEnd = vm.handleResizeEnd as (e: PointerEvent) => void

    resizeStart(makePointerEvent('pointerdown', captureEl, 200, 120), 'se')
    resizeMove(makePointerEvent('pointermove', captureEl, -800, -800))
    resizeEnd(makePointerEvent('pointerup', captureEl, -800, -800))

    expect(vm.modelValue.width).toBe(32)
    expect(vm.modelValue.height).toBe(16)
  })

  it('ends resize and clears direction on pointerup', async () => {
    const vm = await mountHarness()
    setupImageLayout(vm, 400, 400)
    const captureEl = document.createElement('div')
    captureEl.setPointerCapture = vi.fn()
    captureEl.releasePointerCapture = vi.fn()

    const resizeStart = vm.handleResizeStart as (
      e: PointerEvent,
      dir: string
    ) => void
    const resizeMove = vm.handleResizeMove as (e: PointerEvent) => void
    const resizeEnd = vm.handleResizeEnd as (e: PointerEvent) => void
    const h0 = vm.cropHeight as number
    resizeStart(makePointerEvent('pointerdown', captureEl, 10, 10), 'bottom')
    resizeMove(makePointerEvent('pointermove', captureEl, 10, 80))
    resizeEnd(makePointerEvent('pointerup', captureEl, 10, 80))
    expect(vm.cropHeight as number).toBeGreaterThan(h0)
  })
})

describe('WidgetImageCrop', () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        imageCrop: {
          loading: 'Loading...',
          noInputImage: 'No input image connected',
          cropPreviewAlt: 'Crop preview',
          ratio: 'Ratio',
          lockRatio: 'Lock aspect ratio',
          unlockRatio: 'Unlock aspect ratio',
          custom: 'Custom'
        }
      }
    }
  })

  beforeEach(() => {
    resizeObserverCallbacks.length = 0
    vi.clearAllMocks()
    const outputStore: MockOutputStore = {
      nodeOutputs: reactive<Record<string, unknown>>({}),
      nodePreviewImages: reactive<Record<string, unknown>>({}),
      getNodeImageUrls: mockGetNodeImageUrls
    }
    useNodeOutputStoreMock.mockReturnValue(outputStore)
    const source = createMockLGraphNode({ id: 99, isSubgraphNode: () => false })
    const crop = createMockLGraphNode({
      id: 2,
      getInputNode: vi.fn(() => source),
      getInputLink: vi.fn(),
      isSubgraphNode: () => false
    })
    mockResolveNode.mockReturnValue(crop)
    mockGetNodeImageUrls.mockImplementation((n) =>
      n === source ? ['https://example.com/a.png'] : null
    )
    setActivePinia(createTestingPinia({ stubActions: true }))
  })

  it('renders empty state copy when no image URL is available', async () => {
    mockGetNodeImageUrls.mockReturnValue(null)
    const widget = fromPartial<SimplifiedWidget>({
      type: 'imagecrop',
      options: {}
    })
    const attach = document.createElement('div')
    document.body.appendChild(attach)
    const { unmount } = render(WidgetImageCrop, {
      container: attach,
      props: {
        widget,
        nodeId: toNodeId(2),
        modelValue: { x: 0, y: 0, width: 100, height: 100 }
      },
      global: {
        plugins: [i18n],
        stubs: {
          WidgetBoundingBox: {
            name: 'WidgetBoundingBox',
            template: '<div data-testid="bbox-stub" />'
          }
        }
      }
    })
    await flushTicks()
    expect(screen.getByText('No input image connected')).toBeTruthy()
    unmount()
    attach.remove()
  })

  it('shows crop overlay after the preview image loads', async () => {
    const widget = fromPartial<SimplifiedWidget>({
      type: 'imagecrop',
      options: {}
    })
    const attach = document.createElement('div')
    attach.style.width = '420px'
    attach.style.height = '320px'
    document.body.appendChild(attach)
    const { unmount } = render(WidgetImageCrop, {
      container: attach,
      props: {
        widget,
        nodeId: toNodeId(2),
        modelValue: { x: 0, y: 0, width: 200, height: 200 }
      },
      global: {
        plugins: [i18n],
        stubs: {
          WidgetBoundingBox: {
            name: 'WidgetBoundingBox',
            template: '<div data-testid="bbox-stub" />'
          }
        }
      }
    })
    await flushTicks()
    const img = screen.getByAltText('Crop preview')
    Object.defineProperty(img, 'naturalWidth', {
      configurable: true,
      value: 400
    })
    Object.defineProperty(img, 'naturalHeight', {
      configurable: true,
      value: 400
    })
    img.dispatchEvent(new Event('load'))
    await flushTicks()
    expect(screen.getByTestId('crop-overlay')).toBeTruthy()
    unmount()
    attach.remove()
  })

  it('toggles aspect ratio lock from the toolbar button', async () => {
    const user = userEvent.setup()
    const widget = fromPartial<SimplifiedWidget>({
      type: 'imagecrop',
      options: {}
    })
    const attach = document.createElement('div')
    attach.style.width = '420px'
    attach.style.height = '320px'
    document.body.appendChild(attach)
    const { unmount } = render(WidgetImageCrop, {
      container: attach,
      props: {
        widget,
        nodeId: toNodeId(2),
        modelValue: { x: 0, y: 0, width: 200, height: 200 }
      },
      global: {
        plugins: [i18n],
        stubs: {
          WidgetBoundingBox: {
            name: 'WidgetBoundingBox',
            template: '<div data-testid="bbox-stub" />'
          }
        }
      }
    })
    await flushTicks()
    const img = screen.getByAltText('Crop preview')
    Object.defineProperty(img, 'naturalWidth', {
      configurable: true,
      value: 400
    })
    Object.defineProperty(img, 'naturalHeight', {
      configurable: true,
      value: 400
    })
    img.dispatchEvent(new Event('load'))
    await flushTicks()

    await user.click(screen.getByRole('button', { name: 'Lock aspect ratio' }))
    await flushTicks()
    expect(
      screen.getByRole('button', { name: 'Unlock aspect ratio' })
    ).toBeTruthy()
    unmount()
    attach.remove()
  })

  it('renders ratio controls when the widget is enabled', async () => {
    const widget = fromPartial<SimplifiedWidget>({
      type: 'imagecrop',
      options: {}
    })
    const attach = document.createElement('div')
    document.body.appendChild(attach)
    const { unmount } = render(WidgetImageCrop, {
      container: attach,
      props: {
        widget,
        nodeId: toNodeId(2),
        modelValue: { x: 0, y: 0, width: 100, height: 100 }
      },
      global: {
        plugins: [i18n],
        stubs: {
          WidgetBoundingBox: {
            name: 'WidgetBoundingBox',
            template: '<div data-testid="bbox-stub" />'
          }
        }
      }
    })
    await flushTicks()
    expect(screen.getByText('Ratio')).toBeTruthy()
    unmount()
    attach.remove()
  })
})
