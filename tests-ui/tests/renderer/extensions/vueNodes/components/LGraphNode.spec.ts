import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { SelectedNodeIdsKey } from '@/renderer/core/canvas/injectionKeys'
import LGraphNode from '@/renderer/extensions/vueNodes/components/LGraphNode.vue'
import { useVueElementTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'

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
    startDrag: vi.fn(),
    handleDrag: vi.fn(),
    endDrag: vi.fn()
  })
}))

vi.mock('@/renderer/extensions/vueNodes/lod/useLOD', () => ({
  useLOD: () => ({
    lodLevel: { value: 0 },
    shouldRenderWidgets: { value: true },
    shouldRenderSlots: { value: true },
    shouldRenderContent: { value: false },
    lodCssClass: { value: '' }
  }),
  LODLevel: { MINIMAL: 0 }
}))

describe('LGraphNode', () => {
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

  const mountLGraphNode = (props: any, selectedNodeIds = new Set()) => {
    return mount(LGraphNode, {
      props,
      global: {
        provide: {
          [SelectedNodeIdsKey as symbol]: ref(selectedNodeIds)
        }
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call resize tracking composable with node ID', () => {
    mountLGraphNode({ nodeData: mockNodeData })

    expect(useVueElementTracking).toHaveBeenCalledWith('test-node-123', 'node')
  })

  it('should render with data-node-id attribute', () => {
    const wrapper = mountLGraphNode({ nodeData: mockNodeData })

    expect(wrapper.attributes('data-node-id')).toBe('test-node-123')
  })

  it('should render node title', () => {
    const wrapper = mountLGraphNode({ nodeData: mockNodeData })

    expect(wrapper.text()).toContain('Test Node')
  })

  it('should apply selected styling when selected prop is true', () => {
    const wrapper = mountLGraphNode(
      { nodeData: mockNodeData, selected: true },
      new Set(['test-node-123'])
    )
    expect(wrapper.classes()).toContain('outline-2')
    expect(wrapper.classes()).toContain('outline-black')
    expect(wrapper.classes()).toContain('dark-theme:outline-white')
  })

  it('should apply executing animation when executing prop is true', () => {
    const wrapper = mountLGraphNode({ nodeData: mockNodeData, executing: true })

    expect(wrapper.classes()).toContain('animate-pulse')
  })

  it('should emit node-click event on pointer up', async () => {
    const wrapper = mountLGraphNode({ nodeData: mockNodeData })

    await wrapper.trigger('pointerup')

    expect(wrapper.emitted('node-click')).toHaveLength(1)
    expect(wrapper.emitted('node-click')?.[0]).toHaveLength(3)
    expect(wrapper.emitted('node-click')?.[0][1]).toEqual(mockNodeData)
  })
})
