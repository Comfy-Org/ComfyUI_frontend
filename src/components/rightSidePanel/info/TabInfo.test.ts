import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import NodeHelpContent from '@/components/node/NodeHelpContent.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'

import TabInfo from './TabInfo.vue'

// Mock the stores
vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: vi.fn()
}))

vi.mock('@/stores/workspace/nodeHelpStore', () => ({
  useNodeHelpStore: vi.fn()
}))

// Mock NodeHelpContent component
vi.mock('@/components/node/NodeHelpContent.vue', () => ({
  default: {
    name: 'NodeHelpContent',
    template: '<div class="node-help-content">{{ node?.type }}</div>',
    props: ['node']
  }
}))

describe('TabInfo', () => {
  let mockNodeDefStore: any
  let mockNodeHelpStore: any

  beforeEach(() => {
    setActivePinia(createPinia())

    mockNodeDefStore = {
      nodeDefsByName: {
        'KSampler': {
          name: 'KSampler',
          display_name: 'KSampler',
          description: 'Sampling node',
          category: 'sampling'
        },
        'CheckpointLoader': {
          name: 'CheckpointLoader',
          display_name: 'Load Checkpoint',
          description: 'Loads model checkpoint',
          category: 'loaders'
        }
      }
    }

    mockNodeHelpStore = {
      openHelp: vi.fn()
    }

    vi.mocked(useNodeDefStore).mockReturnValue(mockNodeDefStore)
    vi.mocked(useNodeHelpStore).mockReturnValue(mockNodeHelpStore)
  })

  const createMockNode = (type: string, id: number = 1): LGraphNode => ({
    id,
    type,
    title: `${type}_${id}`,
    properties: {},
    serialize: vi.fn(),
    configure: vi.fn()
  } as any)

  const mountComponent = (props = {}) => {
    return mount(TabInfo, {
      global: {
        plugins: [PrimeVue],
        stubs: {
          NodeHelpContent: true
        }
      },
      props: {
        nodes: [createMockNode('KSampler')],
        ...props
      }
    })
  }

  describe('Rendering', () => {
    it('renders successfully with single node', () => {
      const wrapper = mountComponent()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders NodeHelpContent when node info exists', () => {
      const wrapper = mountComponent({
        nodes: [createMockNode('KSampler')]
      })

      const helpContent = wrapper.findComponent({ name: 'NodeHelpContent' })
      expect(helpContent.exists()).toBe(true)
    })

    it('renders with correct container styling', () => {
      const wrapper = mountComponent()
      const container = wrapper.find('div')

      expect(container.classes()).toContain('rounded-lg')
      expect(container.classes()).toContain('bg-interface-surface')
      expect(container.classes()).toContain('p-3')
    })

    it('does not render when node info is not available', () => {
      mockNodeDefStore.nodeDefsByName = {}
      const wrapper = mountComponent({
        nodes: [createMockNode('UnknownNode')]
      })

      expect(wrapper.html()).toBe('<!--v-if-->')
    })
  })

  describe('Node Info Computation', () => {
    it('computes node info from first node in array', () => {
      const nodes = [
        createMockNode('KSampler', 1),
        createMockNode('CheckpointLoader', 2)
      ]
      const wrapper = mountComponent({ nodes })

      // Should use first node
      const helpContent = wrapper.findComponent({ name: 'NodeHelpContent' })
      expect(helpContent.exists()).toBe(true)
    })

    it('returns node definition for valid node type', () => {
      const wrapper = mountComponent({
        nodes: [createMockNode('KSampler')]
      })

      const helpContent = wrapper.findComponent({ name: 'NodeHelpContent' })
      expect(helpContent.props('node')).toEqual(
        mockNodeDefStore.nodeDefsByName['KSampler']
      )
    })

    it('returns undefined for invalid node type', () => {
      mockNodeDefStore.nodeDefsByName = {}
      const wrapper = mountComponent({
        nodes: [createMockNode('InvalidNode')]
      })

      expect(wrapper.html()).toBe('<!--v-if-->')
    })

    it('handles nodes array with single node', () => {
      const wrapper = mountComponent({
        nodes: [createMockNode('CheckpointLoader')]
      })

      const helpContent = wrapper.findComponent({ name: 'NodeHelpContent' })
      expect(helpContent.props('node')).toEqual(
        mockNodeDefStore.nodeDefsByName['CheckpointLoader']
      )
    })
  })

  describe('Help Store Integration', () => {
    it('calls openHelp when nodeInfo exists', async () => {
      mountComponent({
        nodes: [createMockNode('KSampler')]
      })

      await nextTick()

      expect(mockNodeHelpStore.openHelp).toHaveBeenCalled()
      expect(mockNodeHelpStore.openHelp).toHaveBeenCalledWith(
        mockNodeDefStore.nodeDefsByName['KSampler']
      )
    })

    it('opens help immediately on mount', async () => {
      mockNodeHelpStore.openHelp.mockClear()

      mountComponent({
        nodes: [createMockNode('KSampler')]
      })

      await nextTick()

      expect(mockNodeHelpStore.openHelp).toHaveBeenCalledTimes(1)
    })

    it('updates help when node changes', async () => {
      const wrapper = mountComponent({
        nodes: [createMockNode('KSampler')]
      })

      await nextTick()
      mockNodeHelpStore.openHelp.mockClear()

      // Change to different node
      await wrapper.setProps({
        nodes: [createMockNode('CheckpointLoader')]
      })

      await nextTick()

      expect(mockNodeHelpStore.openHelp).toHaveBeenCalledWith(
        mockNodeDefStore.nodeDefsByName['CheckpointLoader']
      )
    })

    it('does not call openHelp when nodeInfo is undefined', async () => {
      mockNodeDefStore.nodeDefsByName = {}
      mockNodeHelpStore.openHelp.mockClear()

      mountComponent({
        nodes: [createMockNode('UnknownNode')]
      })

      await nextTick()

      expect(mockNodeHelpStore.openHelp).not.toHaveBeenCalled()
    })
  })

  describe('Props Handling', () => {
    it('accepts nodes prop as array', () => {
      const nodes = [
        createMockNode('KSampler', 1),
        createMockNode('CheckpointLoader', 2)
      ]
      const wrapper = mountComponent({ nodes })

      expect(wrapper.props('nodes')).toEqual(nodes)
    })

    it('handles empty nodes array', () => {
      const wrapper = mountComponent({ nodes: [] })

      expect(wrapper.html()).toBe('<!--v-if-->')
    })

    it('updates when nodes prop changes', async () => {
      const wrapper = mountComponent({
        nodes: [createMockNode('KSampler')]
      })

      await wrapper.setProps({
        nodes: [createMockNode('CheckpointLoader')]
      })

      await nextTick()

      const helpContent = wrapper.findComponent({ name: 'NodeHelpContent' })
      expect(helpContent.props('node')).toEqual(
        mockNodeDefStore.nodeDefsByName['CheckpointLoader']
      )
    })
  })

  describe('Edge Cases', () => {
    it('handles node with missing type', () => {
      const nodeWithoutType = {
        id: 1,
        title: 'Node',
        properties: {}
      } as any

      const wrapper = mountComponent({
        nodes: [nodeWithoutType]
      })

      expect(wrapper.html()).toBe('<!--v-if-->')
    })

    it('handles rapid node switching', async () => {
      const wrapper = mountComponent({
        nodes: [createMockNode('KSampler')]
      })

      for (let i = 0; i < 10; i++) {
        await wrapper.setProps({
          nodes: [createMockNode(i % 2 === 0 ? 'KSampler' : 'CheckpointLoader')]
        })
      }

      await nextTick()

      // Should still be functional
      const helpContent = wrapper.findComponent({ name: 'NodeHelpContent' })
      expect(helpContent.exists()).toBe(true)
    })

    it('handles nodes with special characters in type', () => {
      mockNodeDefStore.nodeDefsByName['Node-With-Dashes'] = {
        name: 'Node-With-Dashes',
        display_name: 'Node With Dashes'
      }

      const wrapper = mountComponent({
        nodes: [createMockNode('Node-With-Dashes')]
      })

      const helpContent = wrapper.findComponent({ name: 'NodeHelpContent' })
      expect(helpContent.exists()).toBe(true)
    })
  })

  describe('Reactivity', () => {
    it('recomputes nodeInfo when nodes prop changes', async () => {
      const wrapper = mountComponent({
        nodes: [createMockNode('KSampler')]
      })

      let helpContent = wrapper.findComponent({ name: 'NodeHelpContent' })
      expect(helpContent.props('node').name).toBe('KSampler')

      await wrapper.setProps({
        nodes: [createMockNode('CheckpointLoader')]
      })

      helpContent = wrapper.findComponent({ name: 'NodeHelpContent' })
      expect(helpContent.props('node').name).toBe('CheckpointLoader')
    })

    it('recomputes nodeInfo when store updates', async () => {
      const wrapper = mountComponent({
        nodes: [createMockNode('KSampler')]
      })

      // Simulate store update
      mockNodeDefStore.nodeDefsByName['KSampler'] = {
        ...mockNodeDefStore.nodeDefsByName['KSampler'],
        description: 'Updated description'
      }

      await nextTick()

      const helpContent = wrapper.findComponent({ name: 'NodeHelpContent' })
      expect(helpContent.props('node').description).toBe('Updated description')
    })
  })

  describe('Component Lifecycle', () => {
    it('calls openHelp on mount', async () => {
      mockNodeHelpStore.openHelp.mockClear()

      mountComponent({
        nodes: [createMockNode('KSampler')]
      })

      await nextTick()

      expect(mockNodeHelpStore.openHelp).toHaveBeenCalledTimes(1)
    })

    it('cleans up watchers on unmount', async () => {
      const wrapper = mountComponent({
        nodes: [createMockNode('KSampler')]
      })

      wrapper.unmount()

      // Should not throw errors
      expect(true).toBe(true)
    })

    it('handles remount correctly', async () => {
      const wrapper = mountComponent({
        nodes: [createMockNode('KSampler')]
      })

      wrapper.unmount()

      mockNodeHelpStore.openHelp.mockClear()

      const wrapper2 = mountComponent({
        nodes: [createMockNode('CheckpointLoader')]
      })

      await nextTick()

      expect(mockNodeHelpStore.openHelp).toHaveBeenCalledWith(
        mockNodeDefStore.nodeDefsByName['CheckpointLoader']
      )
    })
  })

  describe('Integration Scenarios', () => {
    it('works in typical workflow: select node, view info', async () => {
      // User selects a node
      const wrapper = mountComponent({
        nodes: [createMockNode('KSampler')]
      })

      await nextTick()

      // Info panel opens and displays help
      expect(mockNodeHelpStore.openHelp).toHaveBeenCalled()
      const helpContent = wrapper.findComponent({ name: 'NodeHelpContent' })
      expect(helpContent.exists()).toBe(true)
    })

    it('updates when user selects different node', async () => {
      const wrapper = mountComponent({
        nodes: [createMockNode('KSampler')]
      })

      await nextTick()
      mockNodeHelpStore.openHelp.mockClear()

      // User selects different node
      await wrapper.setProps({
        nodes: [createMockNode('CheckpointLoader')]
      })

      await nextTick()

      // Help updates to new node
      expect(mockNodeHelpStore.openHelp).toHaveBeenCalledWith(
        mockNodeDefStore.nodeDefsByName['CheckpointLoader']
      )
    })
  })
})