import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { FlattenedItem } from 'reka-ui'
import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { InjectKeyContextMenuNode } from '@/types/treeExplorerTypes'

import TreeExplorerV2Node from './TreeExplorerV2Node.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { delete: 'Delete' } } }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn().mockReturnValue('left')
  })
}))

vi.mock('@/stores/nodeBookmarkStore', () => ({
  useNodeBookmarkStore: () => ({
    isBookmarked: vi.fn().mockReturnValue(false),
    toggleBookmark: vi.fn()
  })
}))

const mockDeleteBlueprint = vi.fn()
const mockIsUserBlueprint = vi.fn().mockReturnValue(false)

vi.mock('@/stores/subgraphStore', () => ({
  useSubgraphStore: () => ({
    isUserBlueprint: mockIsUserBlueprint,
    deleteBlueprint: mockDeleteBlueprint,
    typePrefix: 'SubgraphBlueprint.'
  })
}))

vi.mock('@/components/node/NodePreviewCard.vue', () => ({
  default: { template: '<div />' }
}))

const mockStartDrag = vi.fn()
const mockHandleNativeDrop = vi.fn()

vi.mock('@/composables/node/useNodeDragToCanvas', () => ({
  useNodeDragToCanvas: () => ({
    startDrag: mockStartDrag,
    handleNativeDrop: mockHandleNativeDrop
  })
}))

describe('TreeExplorerV2Node', () => {
  function createMockItem(
    type: 'node' | 'folder',
    overrides: Record<string, unknown> = {}
  ): FlattenedItem<RenderedTreeExplorerNode<ComfyNodeDefImpl>> {
    const value = {
      key: 'test-key',
      label: 'Test Label',
      type,
      icon: 'pi pi-folder',
      totalLeaves: 5,
      ...overrides
    } as RenderedTreeExplorerNode<ComfyNodeDefImpl>
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

  function renderComponent(
    props: Record<string, unknown> = {},
    options: {
      provide?: Record<string, unknown>
      treeItemStub?: ReturnType<typeof createTreeItemStub>
    } = {}
  ) {
    const treeItemStub = options.treeItemStub ?? createTreeItemStub()
    const onNodeClick = vi.fn()
    const { container } = render(TreeExplorerV2Node, {
      global: {
        plugins: [i18n],
        stubs: {
          TreeItem: treeItemStub.stub,
          Teleport: { template: '<div />' }
        },
        provide: {
          ...options.provide
        }
      },
      props: {
        item: createMockItem('node'),
        onNodeClick,
        ...props
      }
    })
    return { container, treeItemStub, onNodeClick }
  }

  function getTreeNode(container: Element) {
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    return container.querySelector('div.group\\/tree-node')! as HTMLElement
  }

  describe('handleClick', () => {
    it('emits nodeClick event when clicked', async () => {
      const user = userEvent.setup()
      const { container, onNodeClick } = renderComponent({
        item: createMockItem('node')
      })

      const nodeDiv = getTreeNode(container)
      await user.click(nodeDiv)

      expect(onNodeClick).toHaveBeenCalled()
      expect(onNodeClick.mock.calls[0][0]).toMatchObject({
        type: 'node',
        label: 'Test Label'
      })
    })

    it('calls handleToggle for folder items', async () => {
      const user = userEvent.setup()
      const treeItemStub = createTreeItemStub()
      const { container, onNodeClick } = renderComponent(
        { item: createMockItem('folder') },
        { treeItemStub }
      )

      const folderDiv = getTreeNode(container)
      await user.click(folderDiv)

      expect(onNodeClick).toHaveBeenCalled()
      expect(treeItemStub.handleToggle).toHaveBeenCalled()
    })

    it('does not call handleToggle for node items', async () => {
      const user = userEvent.setup()
      const treeItemStub = createTreeItemStub()
      const { container, onNodeClick } = renderComponent(
        { item: createMockItem('node') },
        { treeItemStub }
      )

      const nodeDiv = getTreeNode(container)
      await user.click(nodeDiv)

      expect(onNodeClick).toHaveBeenCalled()
      expect(treeItemStub.handleToggle).not.toHaveBeenCalled()
    })
  })

  describe('context menu', () => {
    it('sets contextMenuNode when contextmenu event is triggered on node', async () => {
      const contextMenuNode = ref<RenderedTreeExplorerNode | null>(null)
      const nodeItem = createMockItem('node')

      const { container } = renderComponent(
        { item: nodeItem },
        {
          provide: {
            [InjectKeyContextMenuNode as symbol]: contextMenuNode
          }
        }
      )

      const nodeDiv = getTreeNode(container)
      await fireEvent.contextMenu(nodeDiv)

      expect(contextMenuNode.value).toEqual(nodeItem.value)
    })

    it('clears contextMenuNode when right-clicking a folder', async () => {
      const contextMenuNode = ref<RenderedTreeExplorerNode | null>({
        key: 'stale',
        type: 'node',
        label: 'Stale'
      } as RenderedTreeExplorerNode)

      const { container } = renderComponent(
        { item: createMockItem('folder') },
        {
          provide: {
            [InjectKeyContextMenuNode as symbol]: contextMenuNode
          }
        }
      )

      const folderDiv = getTreeNode(container)
      await fireEvent.contextMenu(folderDiv)

      expect(contextMenuNode.value).toBeNull()
    })
  })

  describe('blueprint actions', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('shows delete button for user blueprints', () => {
      mockIsUserBlueprint.mockReturnValue(true)
      renderComponent({
        item: createMockItem('node', {
          data: { name: 'SubgraphBlueprint.test' }
        })
      })

      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    it('hides delete button for non-blueprint nodes', () => {
      mockIsUserBlueprint.mockReturnValue(false)
      renderComponent({
        item: createMockItem('node', {
          data: { name: 'KSampler' }
        })
      })

      expect(
        screen.queryByRole('button', { name: 'Delete' })
      ).not.toBeInTheDocument()
    })

    it('always shows bookmark button', () => {
      mockIsUserBlueprint.mockReturnValue(true)
      renderComponent({
        item: createMockItem('node', {
          data: { name: 'SubgraphBlueprint.test' }
        })
      })

      expect(
        screen.getByRole('button', { name: 'icon.bookmark' })
      ).toBeInTheDocument()
    })

    it('calls deleteBlueprint when delete button is clicked', async () => {
      const user = userEvent.setup()
      mockIsUserBlueprint.mockReturnValue(true)
      const nodeName = 'SubgraphBlueprint.test'
      renderComponent({
        item: createMockItem('node', {
          data: { name: nodeName }
        })
      })

      const deleteButton = screen.getByRole('button', { name: 'Delete' })
      await user.click(deleteButton)

      expect(mockDeleteBlueprint).toHaveBeenCalledWith(nodeName)
    })
  })

  describe('rendering', () => {
    it('renders node icon for node type', () => {
      const { container } = renderComponent({
        item: createMockItem('node')
      })

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      expect(container.querySelector('i.icon-\\[comfy--node\\]')).toBeTruthy()
    })

    it('renders folder icon for folder type', () => {
      const { container } = renderComponent({
        item: createMockItem('folder', { icon: 'icon-[lucide--folder]' })
      })

      /* eslint-disable testing-library/no-container, testing-library/no-node-access */
      expect(
        container.querySelector('i.icon-\\[lucide--folder\\]')
      ).toBeTruthy()
      /* eslint-enable testing-library/no-container, testing-library/no-node-access */
    })

    it('renders label text', () => {
      renderComponent({
        item: createMockItem('node', { label: 'My Node' })
      })

      expect(screen.getByText('My Node')).toBeInTheDocument()
    })

    it('renders chevron for folder with children', () => {
      const { container } = renderComponent({
        item: {
          ...createMockItem('folder'),
          hasChildren: true
        }
      })

      /* eslint-disable testing-library/no-container, testing-library/no-node-access */
      expect(
        container.querySelector('i.icon-\\[lucide--chevron-down\\]')
      ).toBeTruthy()
      /* eslint-enable testing-library/no-container, testing-library/no-node-access */
    })
  })

  describe('drag and drop', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('sets draggable attribute on node items', () => {
      const { container } = renderComponent({
        item: createMockItem('node')
      })

      const nodeDiv = getTreeNode(container)
      expect(nodeDiv.getAttribute('draggable')).toBe('true')
    })

    it('does not set draggable on folder items', () => {
      const { container } = renderComponent({
        item: createMockItem('folder')
      })

      const folderDiv = getTreeNode(container)
      expect(folderDiv.getAttribute('draggable')).toBeNull()
    })

    it('calls startDrag with native mode on dragstart', async () => {
      const mockData = { name: 'TestNode' }
      const { container } = renderComponent({
        item: createMockItem('node', { data: mockData })
      })

      const nodeDiv = getTreeNode(container)
      await fireEvent.dragStart(nodeDiv)

      expect(mockStartDrag).toHaveBeenCalledWith(mockData, 'native')
    })

    it('does not call startDrag for folder items on dragstart', async () => {
      const { container } = renderComponent({
        item: createMockItem('folder')
      })

      const folderDiv = getTreeNode(container)
      await fireEvent.dragStart(folderDiv)

      expect(mockStartDrag).not.toHaveBeenCalled()
    })

    it('calls handleNativeDrop on dragend with drop coordinates', async () => {
      const mockData = { name: 'TestNode' }
      const { container } = renderComponent({
        item: createMockItem('node', { data: mockData })
      })

      const nodeDiv = getTreeNode(container)

      await fireEvent.dragStart(nodeDiv)

      const dragEndEvent = new DragEvent('dragend', { bubbles: true })
      Object.defineProperty(dragEndEvent, 'clientX', { value: 100 })
      Object.defineProperty(dragEndEvent, 'clientY', { value: 200 })

      nodeDiv.dispatchEvent(dragEndEvent)
      await nextTick()

      expect(mockHandleNativeDrop).toHaveBeenCalledWith(100, 200)
    })

    it('calls handleNativeDrop regardless of dropEffect', async () => {
      const mockData = { name: 'TestNode' }
      const { container } = renderComponent({
        item: createMockItem('node', { data: mockData })
      })

      const nodeDiv = getTreeNode(container)

      await fireEvent.dragStart(nodeDiv)
      mockHandleNativeDrop.mockClear()

      const dragEndEvent = new DragEvent('dragend', { bubbles: true })
      Object.defineProperty(dragEndEvent, 'clientX', { value: 300 })
      Object.defineProperty(dragEndEvent, 'clientY', { value: 400 })
      Object.defineProperty(dragEndEvent, 'dataTransfer', {
        value: { dropEffect: 'none' }
      })

      nodeDiv.dispatchEvent(dragEndEvent)
      await nextTick()

      expect(mockHandleNativeDrop).toHaveBeenCalledWith(300, 400)
    })
  })
})
