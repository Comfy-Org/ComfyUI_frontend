import { mount } from '@vue/test-utils'
import type { FlattenedItem } from 'reka-ui'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { InjectKeyContextMenuNode } from '@/types/treeExplorerTypes'

import TreeExplorerV2Node from './TreeExplorerV2Node.vue'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn().mockReturnValue('left')
  })
}))

vi.mock('@/components/node/NodePreviewCard.vue', () => ({
  default: { template: '<div />' }
}))

const mockStartDrag = vi.fn()
const mockHandleNativeDrop = vi.fn()
const mockCancelDrag = vi.fn()

vi.mock('@/composables/node/useNodeDragToCanvas', () => ({
  useNodeDragToCanvas: () => ({
    startDrag: mockStartDrag,
    handleNativeDrop: mockHandleNativeDrop,
    cancelDrag: mockCancelDrag
  })
}))

describe('TreeExplorerV2Node', () => {
  function createMockItem(
    type: 'node' | 'folder',
    overrides: Record<string, unknown> = {}
  ): FlattenedItem<RenderedTreeExplorerNode> {
    const value = {
      key: 'test-key',
      label: 'Test Label',
      type,
      icon: 'pi pi-folder',
      totalLeaves: 5,
      ...overrides
    } as RenderedTreeExplorerNode
    return {
      _id: 'test-id',
      index: 0,
      value,
      level: 1,
      hasChildren: type === 'folder',
      bind: { value, level: 1 }
    }
  }

  function createTreeItemStub() {
    const handleToggle = vi.fn()
    const handleSelect = vi.fn()
    return {
      handleToggle,
      handleSelect,
      stub: {
        template: `<div data-testid="tree-item"><slot :isExpanded="false" :isSelected="false" :handleToggle="handleToggle" :handleSelect="handleSelect" /></div>`,
        setup() {
          return { handleToggle, handleSelect }
        }
      }
    }
  }

  function mountComponent(
    props: Record<string, unknown> = {},
    options: {
      provide?: Record<string, unknown>
      treeItemStub?: ReturnType<typeof createTreeItemStub>
    } = {}
  ) {
    const treeItemStub = options.treeItemStub ?? createTreeItemStub()
    return {
      wrapper: mount(TreeExplorerV2Node, {
        global: {
          stubs: {
            TreeItem: treeItemStub.stub,
            ContextMenuTrigger: {
              name: 'ContextMenuTrigger',
              template: '<div data-testid="context-menu-trigger"><slot /></div>'
            },
            Teleport: { template: '<div />' }
          },
          provide: {
            ...options.provide
          }
        },
        props: {
          item: createMockItem('node'),
          ...props
        }
      }),
      treeItemStub
    }
  }

  describe('handleClick', () => {
    it('emits nodeClick event when clicked', async () => {
      const { wrapper } = mountComponent({
        item: createMockItem('node')
      })

      const nodeDiv = wrapper.find('div.group\\/tree-node')
      await nodeDiv.trigger('click')

      expect(wrapper.emitted('nodeClick')).toBeTruthy()
      expect(wrapper.emitted('nodeClick')?.[0]?.[0]).toMatchObject({
        type: 'node',
        label: 'Test Label'
      })
    })

    it('calls handleToggle for folder items', async () => {
      const treeItemStub = createTreeItemStub()
      const { wrapper } = mountComponent(
        { item: createMockItem('folder') },
        { treeItemStub }
      )

      const folderDiv = wrapper.find('div.group\\/tree-node')
      await folderDiv.trigger('click')

      expect(wrapper.emitted('nodeClick')).toBeTruthy()
      expect(treeItemStub.handleToggle).toHaveBeenCalled()
    })

    it('does not call handleToggle for node items', async () => {
      const treeItemStub = createTreeItemStub()
      const { wrapper } = mountComponent(
        { item: createMockItem('node') },
        { treeItemStub }
      )

      const nodeDiv = wrapper.find('div.group\\/tree-node')
      await nodeDiv.trigger('click')

      expect(wrapper.emitted('nodeClick')).toBeTruthy()
      expect(treeItemStub.handleToggle).not.toHaveBeenCalled()
    })
  })

  describe('context menu', () => {
    it('renders ContextMenuTrigger when showContextMenu is true for nodes', () => {
      const { wrapper } = mountComponent({
        item: createMockItem('node'),
        showContextMenu: true
      })

      expect(
        wrapper.find('[data-testid="context-menu-trigger"]').exists()
      ).toBe(true)
    })

    it('does not render ContextMenuTrigger for folder items', () => {
      const { wrapper } = mountComponent({
        item: createMockItem('folder')
      })

      expect(
        wrapper.find('[data-testid="context-menu-trigger"]').exists()
      ).toBe(false)
    })

    it('sets contextMenuNode when contextmenu event is triggered', async () => {
      const contextMenuNode = ref<RenderedTreeExplorerNode | null>(null)
      const nodeItem = createMockItem('node')

      const { wrapper } = mountComponent(
        {
          item: nodeItem,
          showContextMenu: true
        },
        {
          provide: {
            [InjectKeyContextMenuNode as symbol]: contextMenuNode
          }
        }
      )

      const nodeDiv = wrapper.find('div.group\\/tree-node')
      await nodeDiv.trigger('contextmenu')

      expect(contextMenuNode.value).toEqual(nodeItem.value)
    })
  })

  describe('rendering', () => {
    it('renders node icon for node type', () => {
      const { wrapper } = mountComponent({
        item: createMockItem('node')
      })

      expect(wrapper.find('i.icon-\\[comfy--node\\]').exists()).toBe(true)
    })

    it('renders folder icon for folder type', () => {
      const { wrapper } = mountComponent({
        item: createMockItem('folder', { icon: 'icon-[ph--folder-fill]' })
      })

      expect(wrapper.find('i.icon-\\[ph--folder-fill\\]').exists()).toBe(true)
    })

    it('renders label text', () => {
      const { wrapper } = mountComponent({
        item: createMockItem('node', { label: 'My Node' })
      })

      expect(wrapper.text()).toContain('My Node')
    })

    it('renders chevron for folder with children', () => {
      const { wrapper } = mountComponent({
        item: {
          ...createMockItem('folder'),
          hasChildren: true
        }
      })

      expect(wrapper.find('i.icon-\\[lucide--chevron-down\\]').exists()).toBe(
        true
      )
    })
  })

  describe('drag and drop', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('sets draggable attribute on node items', () => {
      const { wrapper } = mountComponent({
        item: createMockItem('node')
      })

      const nodeDiv = wrapper.find('div.group\\/tree-node')
      expect(nodeDiv.attributes('draggable')).toBe('true')
    })

    it('does not set draggable on folder items', () => {
      const { wrapper } = mountComponent({
        item: createMockItem('folder')
      })

      const folderDiv = wrapper.find('div.group\\/tree-node')
      expect(folderDiv.attributes('draggable')).toBeUndefined()
    })

    it('calls startDrag with native mode on dragstart', async () => {
      const mockData = { name: 'TestNode' }
      const { wrapper } = mountComponent({
        item: createMockItem('node', { data: mockData })
      })

      const nodeDiv = wrapper.find('div.group\\/tree-node')
      await nodeDiv.trigger('dragstart')

      expect(mockStartDrag).toHaveBeenCalledWith(mockData, 'native')
    })

    it('does not call startDrag for folder items on dragstart', async () => {
      const { wrapper } = mountComponent({
        item: createMockItem('folder')
      })

      const folderDiv = wrapper.find('div.group\\/tree-node')
      await folderDiv.trigger('dragstart')

      expect(mockStartDrag).not.toHaveBeenCalled()
    })

    it('calls handleNativeDrop on dragend with valid drop', async () => {
      const mockData = { name: 'TestNode' }
      const { wrapper } = mountComponent({
        item: createMockItem('node', { data: mockData })
      })

      const nodeDiv = wrapper.find('div.group\\/tree-node')

      await nodeDiv.trigger('dragstart')

      const dragEndEvent = new DragEvent('dragend', { bubbles: true })
      Object.defineProperty(dragEndEvent, 'clientX', { value: 100 })
      Object.defineProperty(dragEndEvent, 'clientY', { value: 200 })
      Object.defineProperty(dragEndEvent, 'dataTransfer', {
        value: { dropEffect: 'copy' }
      })

      await nodeDiv.element.dispatchEvent(dragEndEvent)
      await wrapper.vm.$nextTick()

      expect(mockHandleNativeDrop).toHaveBeenCalledWith(100, 200)
    })

    it('calls cancelDrag on dragend with cancelled drop', async () => {
      const mockData = { name: 'TestNode' }
      const { wrapper } = mountComponent({
        item: createMockItem('node', { data: mockData })
      })

      const nodeDiv = wrapper.find('div.group\\/tree-node')

      await nodeDiv.trigger('dragstart')

      const dragEndEvent = new DragEvent('dragend', { bubbles: true })
      Object.defineProperty(dragEndEvent, 'clientX', { value: 100 })
      Object.defineProperty(dragEndEvent, 'clientY', { value: 200 })
      Object.defineProperty(dragEndEvent, 'dataTransfer', {
        value: { dropEffect: 'none' }
      })

      await nodeDiv.element.dispatchEvent(dragEndEvent)
      await wrapper.vm.$nextTick()

      expect(mockCancelDrag).toHaveBeenCalled()
      expect(mockHandleNativeDrop).not.toHaveBeenCalled()
    })
  })
})
