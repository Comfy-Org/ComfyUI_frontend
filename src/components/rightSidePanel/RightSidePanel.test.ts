import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'

import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import type { GraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import enMessages from '@/locales/en/main.json'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import RightSidePanel from './RightSidePanel.vue'

const mockNodeManager = shallowRef<GraphNodeManager | null>(null)

vi.mock('@/composables/graph/useVueNodeLifecycle', () => ({
  useVueNodeLifecycle: () => ({
    nodeManager: mockNodeManager
  })
}))

// Mock useLayoutMutations (used by useGraphNodeManager)
vi.mock('@/renderer/core/layout/operations/layoutMutations', () => ({
  useLayoutMutations: () => ({
    createNode: vi.fn(),
    setSource: vi.fn()
  })
}))

const createMountConfig = () => {
  return {
    global: {
      stubs: {
        TabParameters: true
      },
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    }
  }
}

const setupGraph = () => {
  const graph = new LGraph()
  mockNodeManager.value = useGraphNodeManager(graph)
  return { graph, canvasStore: useCanvasStore() }
}

describe('RightSidePanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockNodeManager.value = null
  })

  describe('title reactivity', () => {
    it('updates panel title when node.title changes', async () => {
      const { graph, canvasStore } = setupGraph()

      const node = new LGraphNode('Original Title', 'TestNode')
      graph.add(node)
      canvasStore.selectedItems = [node]

      const wrapper = mount(RightSidePanel, createMountConfig())
      await nextTick()
      expect(wrapper.text()).toContain('Original Title')

      node.title = 'Updated Title'

      await nextTick()
      expect(wrapper.text()).toContain('Updated Title')
    })

    it('shows selection count message when multiple nodes are selected', async () => {
      const { graph, canvasStore } = setupGraph()

      const node1 = new LGraphNode('Node 1', 'TestNode')
      const node2 = new LGraphNode('Node 2', 'TestNode')
      graph.add(node1)
      graph.add(node2)
      canvasStore.selectedItems = [node1, node2]

      const wrapper = mount(RightSidePanel, createMountConfig())
      await nextTick()

      expect(wrapper.text()).toContain('2')
      expect(wrapper.text()).not.toContain('Node 1')
      expect(wrapper.text()).not.toContain('Node 2')
    })
  })
})
