import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { nextTick, reactive } from 'vue'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import WidgetImageCrop from './WidgetImageCrop.vue'

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

async function flushTicks() {
  await Promise.resolve()
  await nextTick()
}

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
        nodeId: 2 as NodeId,
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
        nodeId: 2 as NodeId,
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
        nodeId: 2 as NodeId,
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
        nodeId: 2 as NodeId,
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
