/* eslint-disable vue/one-component-per-file */

import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { createApp, defineComponent, nextTick, reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
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
      ...useImageCrop(props.nodeId as NodeId, {
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
  target: HTMLElement,
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

  const container = vm.$el as HTMLDivElement
  const img = container.querySelector('img')

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

async function mountHarness(nodeId: NodeId = 2 as NodeId) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp(ImageCropHarness, { nodeId: Number(nodeId) })
  const vm = app.mount(el) as unknown as CropVm
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

    const container = vm.$el as HTMLDivElement
    const img = container.querySelector('img')

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
