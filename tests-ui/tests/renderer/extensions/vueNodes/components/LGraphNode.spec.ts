import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, toValue } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import LGraphNode from '@/renderer/extensions/vueNodes/components/LGraphNode.vue'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { useVueElementTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'

const mockData = vi.hoisted(() => ({
  mockNodeIds: new Set<string>(),
  mockExecuting: false
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => {
  const getCanvas = vi.fn()
  const useCanvasStore = () => ({
    getCanvas,
    selectedNodeIds: computed(() => mockData.mockNodeIds)
  })
  return {
    useCanvasStore
  }
})

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers',
  () => {
    const handleNodeSelect = vi.fn()
    return { useNodeEventHandlers: () => ({ handleNodeSelect }) }
  }
)

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking',
  () => ({
    useVueElementTracking: vi.fn()
  })
)

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    toastErrorHandler: vi.fn()
  })
}))

vi.mock('@/renderer/extensions/vueNodes/layout/useNodeLayout', () => ({
  useNodeLayout: () => ({
    position: { x: 100, y: 50 },
    size: { width: 200, height: 100 },
    startDrag: vi.fn(),
    handleDrag: vi.fn(),
    endDrag: vi.fn()
  })
}))

vi.mock(
  '@/renderer/extensions/vueNodes/execution/useNodeExecutionState',
  () => ({
    useNodeExecutionState: vi.fn(() => ({
      executing: computed(() => mockData.mockExecuting),
      progress: computed(() => undefined),
      progressPercentage: computed(() => undefined),
      progressState: computed(() => undefined as any),
      executionState: computed(() => 'idle' as const)
    }))
  })
)

vi.mock('@/renderer/extensions/vueNodes/preview/useNodePreviewState', () => ({
  useNodePreviewState: vi.fn(() => ({
    latestPreviewUrl: computed(() => ''),
    shouldShowPreviewImg: computed(() => false)
  }))
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      'Node Render Error': 'Node Render Error'
    }
  }
})
function mountLGraphNode(props: ComponentProps<typeof LGraphNode>) {
  return mount(LGraphNode, {
    props,
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn
        }),
        i18n
      ],
      stubs: {
        NodeHeader: true,
        NodeSlots: true,
        NodeWidgets: true,
        NodeContent: true,
        SlotConnectionDot: true
      }
    }
  })
}
const mockNodeData: VueNodeData = {
  id: 'test-node-123',
  title: 'Test Node',
  type: 'TestNode',
  mode: 0,
  flags: {},
  inputs: [],
  outputs: [],
  widgets: [],
  selected: false,
  executing: false
}

describe('LGraphNode', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockData.mockNodeIds = new Set()
    mockData.mockExecuting = false
  })

  it('should call resize tracking composable with node ID', () => {
    mountLGraphNode({ nodeData: mockNodeData })

    expect(useVueElementTracking).toHaveBeenCalledWith(
      expect.any(Function),
      'node'
    )
    const idArg = vi.mocked(useVueElementTracking).mock.calls[0]?.[0]
    const id = toValue(idArg)
    expect(id).toEqual('test-node-123')
  })

  it('should render with data-node-id attribute', () => {
    const wrapper = mountLGraphNode({ nodeData: mockNodeData })

    expect(wrapper.attributes('data-node-id')).toBe('test-node-123')
  })

  it('should render node title', () => {
    // Don't stub NodeHeader for this test so we can see the title
    const wrapper = mount(LGraphNode, {
      props: { nodeData: mockNodeData },
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn
          }),
          i18n
        ],
        stubs: {
          NodeSlots: true,
          NodeWidgets: true,
          NodeContent: true,
          SlotConnectionDot: true
        }
      }
    })

    expect(wrapper.text()).toContain('Test Node')
  })

  it('should apply selected styling when selected prop is true', () => {
    mockData.mockNodeIds = new Set(['test-node-123'])
    const wrapper = mountLGraphNode({ nodeData: mockNodeData })
    expect(wrapper.classes()).toContain('outline-2')
    expect(wrapper.classes()).toContain('outline-black')
    expect(wrapper.classes()).toContain('dark-theme:outline-white')
  })

  it('should apply executing animation when executing prop is true', () => {
    mockData.mockExecuting = true

    const wrapper = mountLGraphNode({ nodeData: mockNodeData })

    expect(wrapper.classes()).toContain('animate-pulse')
  })

  it('should emit node-click event on pointer up', async () => {
    const { handleNodeSelect } = useNodeEventHandlers()
    const wrapper = mountLGraphNode({ nodeData: mockNodeData })

    await wrapper.trigger('pointerup')

    expect(handleNodeSelect).toHaveBeenCalledOnce()
    expect(handleNodeSelect).toHaveBeenCalledWith(
      expect.any(PointerEvent),
      mockNodeData,
      expect.any(Boolean)
    )
  })
})
