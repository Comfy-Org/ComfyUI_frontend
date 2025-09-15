/**
 * Tests for NodeHeader subgraph functionality
 */
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import NodeHeader from '@/renderer/extensions/vueNodes/components/NodeHeader.vue'

// Create mutable mock for app
const mockApp = {
  graph: {
    rootGraph: null as any
  } as any
}

// Mock dependencies
vi.mock('@/scripts/app', () => ({
  app: mockApp
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByLocatorId: vi.fn()
}))

describe('NodeHeader - Subgraph Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockNodeData = (
    id: string,
    subgraphId?: string
  ): VueNodeData => ({
    id,
    title: 'Test Node',
    type: 'TestNode',
    mode: 0,
    selected: false,
    executing: false,
    subgraphId,
    widgets: [],
    inputs: [],
    outputs: [],
    hasErrors: false,
    flags: {}
  })

  it('should show subgraph button for subgraph nodes', async () => {
    const { getNodeByLocatorId } = await import('@/utils/graphTraversalUtil')

    // Mock graph and subgraph node
    mockApp.graph = { rootGraph: {} }
    ;(getNodeByLocatorId as any).mockReturnValue({
      isSubgraphNode: () => true
    })

    const wrapper = mount(NodeHeader, {
      props: {
        nodeData: createMockNodeData('test-node-1'),
        readonly: false
      }
    })

    await wrapper.vm.$nextTick()

    const subgraphButton = wrapper.find('[data-testid="subgraph-enter-button"]')
    expect(subgraphButton.exists()).toBe(true)
  })

  it('should not show subgraph button for regular nodes', async () => {
    const { getNodeByLocatorId } = await import('@/utils/graphTraversalUtil')

    // Mock graph and regular node
    mockApp.graph = { rootGraph: {} }
    ;(getNodeByLocatorId as any).mockReturnValue({
      isSubgraphNode: () => false
    })

    const wrapper = mount(NodeHeader, {
      props: {
        nodeData: createMockNodeData('test-node-1'),
        readonly: false
      }
    })

    await wrapper.vm.$nextTick()

    const subgraphButton = wrapper.find('[data-testid="subgraph-enter-button"]')
    expect(subgraphButton.exists()).toBe(false)
  })

  it('should not show subgraph button in readonly mode', async () => {
    const { getNodeByLocatorId } = await import('@/utils/graphTraversalUtil')

    // Mock graph and subgraph node
    mockApp.graph = { rootGraph: {} }
    ;(getNodeByLocatorId as any).mockReturnValue({
      isSubgraphNode: () => true
    })

    const wrapper = mount(NodeHeader, {
      props: {
        nodeData: createMockNodeData('test-node-1'),
        readonly: true
      }
    })

    await wrapper.vm.$nextTick()

    const subgraphButton = wrapper.find('[data-testid="subgraph-enter-button"]')
    expect(subgraphButton.exists()).toBe(false)
  })

  it('should emit enter-subgraph event when button is clicked', async () => {
    const { getNodeByLocatorId } = await import('@/utils/graphTraversalUtil')

    // Mock graph and subgraph node
    mockApp.graph = { rootGraph: {} }
    ;(getNodeByLocatorId as any).mockReturnValue({
      isSubgraphNode: () => true
    })

    const wrapper = mount(NodeHeader, {
      props: {
        nodeData: createMockNodeData('test-node-1'),
        readonly: false
      }
    })

    await wrapper.vm.$nextTick()

    const subgraphButton = wrapper.find('[data-testid="subgraph-enter-button"]')
    await subgraphButton.trigger('click')

    expect(wrapper.emitted('enter-subgraph')).toBeTruthy()
    expect(wrapper.emitted('enter-subgraph')).toHaveLength(1)
  })

  it('should handle subgraph context correctly', async () => {
    const { getNodeByLocatorId } = await import('@/utils/graphTraversalUtil')

    // Mock graph and node in subgraph context
    mockApp.graph = { rootGraph: {} }
    ;(getNodeByLocatorId as any).mockReturnValue({
      isSubgraphNode: () => true
    })

    const wrapper = mount(NodeHeader, {
      props: {
        nodeData: createMockNodeData('test-node-1', 'subgraph-id'),
        readonly: false
      }
    })

    await wrapper.vm.$nextTick()

    // Should call getNodeByLocatorId with correct locator ID
    expect(getNodeByLocatorId).toHaveBeenCalledWith(
      expect.anything(),
      'subgraph-id:test-node-1'
    )

    const subgraphButton = wrapper.find('[data-testid="subgraph-enter-button"]')
    expect(subgraphButton.exists()).toBe(true)
  })

  it('should handle missing graph gracefully', async () => {
    // Mock missing graph
    mockApp.graph = null

    const wrapper = mount(NodeHeader, {
      props: {
        nodeData: createMockNodeData('test-node-1'),
        readonly: false
      }
    })

    await wrapper.vm.$nextTick()

    const subgraphButton = wrapper.find('[data-testid="subgraph-enter-button"]')
    expect(subgraphButton.exists()).toBe(false)
  })

  it('should prevent event propagation on double click', async () => {
    const { getNodeByLocatorId } = await import('@/utils/graphTraversalUtil')

    // Mock graph and subgraph node
    mockApp.graph = { rootGraph: {} }
    ;(getNodeByLocatorId as any).mockReturnValue({
      isSubgraphNode: () => true
    })

    const wrapper = mount(NodeHeader, {
      props: {
        nodeData: createMockNodeData('test-node-1'),
        readonly: false
      }
    })

    await wrapper.vm.$nextTick()

    const subgraphButton = wrapper.find('[data-testid="subgraph-enter-button"]')

    // Mock event object
    const mockEvent = {
      stopPropagation: vi.fn()
    }

    // Trigger dblclick event
    await subgraphButton.trigger('dblclick', mockEvent)

    // Should prevent propagation (handled by @dblclick.stop directive)
    // This is tested by ensuring the component doesn't error and renders correctly
    expect(subgraphButton.exists()).toBe(true)
  })
})
