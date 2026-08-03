import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type {
  TreeExplorerDragAndDropData,
  TreeExplorerNode,
  TreeNode
} from '@/types/treeExplorerTypes'

import NodeBookmarkTreeExplorer from './NodeBookmarkTreeExplorer.vue'

const {
  mockAddBookmark,
  mockDeleteBookmarkFolder,
  mockIsBookmarked,
  mockToggleBookmark,
  mockAddNodeOnGraph,
  mockToggleNodeOnEvent,
  captureRoot,
  getRoot,
  resetRoot
} = vi.hoisted(() => {
  let capturedRoot: TreeExplorerNode<unknown> | null = null
  return {
    mockAddBookmark: vi.fn(),
    mockDeleteBookmarkFolder: vi.fn(),
    mockIsBookmarked: vi.fn().mockReturnValue(false),
    mockToggleBookmark: vi.fn(),
    mockAddNodeOnGraph: vi.fn(),
    mockToggleNodeOnEvent: vi.fn(),
    captureRoot: (root: TreeExplorerNode<unknown>) => {
      capturedRoot = root
    },
    getRoot: () => capturedRoot as TreeExplorerNode<ComfyNodeDefImpl>,
    resetRoot: () => {
      capturedRoot = null
    }
  }
})

const mockFolderNodeDef = fromPartial<ComfyNodeDefImpl>({
  name: 'MyFolder',
  category: '',
  nodePath: 'MyFolder/',
  isDummyFolder: true,
  display_name: 'MyFolder'
})

const mockLeafNodeDef = fromPartial<ComfyNodeDefImpl>({
  name: 'CLIPTextEncode',
  category: 'MyFolder',
  nodePath: 'MyFolder/CLIPTextEncode',
  isDummyFolder: false,
  display_name: 'CLIP Text Encode'
})

const mockBookmarkedRoot: TreeNode = {
  key: 'root',
  label: 'Root',
  leaf: false,
  children: [
    {
      key: 'MyFolder/',
      label: 'MyFolder',
      leaf: false,
      data: mockFolderNodeDef,
      children: [
        {
          key: 'CLIPTextEncode',
          label: 'CLIP Text Encode',
          leaf: true,
          data: mockLeafNodeDef
        }
      ]
    }
  ]
}

vi.mock('@/stores/nodeBookmarkStore', () => ({
  useNodeBookmarkStore: () => ({
    bookmarks: [],
    bookmarkedRoot: mockBookmarkedRoot,
    isBookmarked: mockIsBookmarked,
    toggleBookmark: mockToggleBookmark,
    addBookmark: mockAddBookmark,
    deleteBookmarkFolder: mockDeleteBookmarkFolder,
    addNewBookmarkFolder: vi.fn(),
    renameBookmarkFolder: vi.fn(),
    bookmarksCustomization: {},
    defaultBookmarkIcon: 'pi-bookmark-fill',
    defaultBookmarkColor: '#a1a1aa',
    updateCustomization: vi.fn()
  })
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ addNodeOnGraph: mockAddNodeOnGraph })
}))

vi.mock('@/composables/useTreeExpansion', () => ({
  useTreeExpansion: () => ({
    expandNode: vi.fn(),
    toggleNodeOnEvent: mockToggleNodeOnEvent
  })
}))

vi.mock('@/components/common/TreeExplorer.vue', () => ({
  default: {
    name: 'TreeExplorer',
    template: '<div />',
    props: ['root', 'expandedKeys'],
    setup(props: { root: TreeExplorerNode<unknown> }) {
      captureRoot(props.root)
    }
  }
}))

vi.mock('@/components/common/CustomizationDialog.vue', () => ({
  default: {
    name: 'FolderCustomizationDialog',
    template: '<div />',
    props: ['modelValue', 'initialIcon', 'initialColor']
  }
}))

vi.mock('@/components/node/NodePreview.vue', () => ({
  default: { name: 'NodePreview', template: '<div />' }
}))

vi.mock('@/components/sidebar/tabs/nodeLibrary/NodeTreeFolder.vue', () => ({
  default: { name: 'NodeTreeFolder', template: '<div />', props: ['node'] }
}))

vi.mock('@/components/sidebar/tabs/nodeLibrary/NodeTreeLeaf.vue', () => ({
  default: {
    name: 'NodeTreeLeaf',
    template: '<div />',
    props: ['node', 'openNodeHelp']
  }
}))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

describe('NodeBookmarkTreeExplorer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsBookmarked.mockReturnValue(false)
    resetRoot()
  })

  async function renderAndGetRoot(): Promise<
    TreeExplorerNode<ComfyNodeDefImpl>
  > {
    render(NodeBookmarkTreeExplorer, {
      global: { plugins: [i18n], stubs: { teleport: true } },
      props: { filteredNodeDefs: [], openNodeHelp: vi.fn() }
    })
    await nextTick()
    const root = getRoot()
    expect(root).not.toBeNull()
    return root!
  }

  describe('handleDrop', () => {
    it('adds bookmark when a node is dragged onto a folder', async () => {
      const root = await renderAndGetRoot()
      const folderNode = root.children?.[0]

      await folderNode?.handleDrop?.call(
        folderNode,
        fromPartial<TreeExplorerDragAndDropData<ComfyNodeDefImpl>>({
          data: { data: mockLeafNodeDef }
        })
      )

      expect(mockAddBookmark).toHaveBeenCalled()
    })

    it('moves bookmark when a node is dragged onto a folder and is bookmarked', async () => {
      mockIsBookmarked.mockReturnValue(true)
      const root = await renderAndGetRoot()
      const folderNode = root.children?.[0]

      await folderNode?.handleDrop?.call(
        folderNode,
        fromPartial<TreeExplorerDragAndDropData<ComfyNodeDefImpl>>({
          data: { data: mockLeafNodeDef }
        })
      )

      expect(mockToggleBookmark).toHaveBeenCalledWith(mockLeafNodeDef)
      expect(mockAddBookmark).toHaveBeenCalled()
    })

    it('is a no-op when the dragged node carries no data', async () => {
      const root = await renderAndGetRoot()
      const folderNode = root.children?.[0]

      await folderNode?.handleDrop?.call(
        folderNode,
        fromPartial<TreeExplorerDragAndDropData<ComfyNodeDefImpl>>({
          data: { data: undefined }
        })
      )

      expect(mockAddBookmark).not.toHaveBeenCalled()
    })
  })

  describe('handleClick', () => {
    it('adds node on graph when a leaf node is clicked', async () => {
      const root = await renderAndGetRoot()
      const leafNode = root.children?.[0].children?.[0]
      const mockEvent = new MouseEvent('click')

      await leafNode?.handleClick?.call(leafNode, mockEvent)

      expect(mockAddNodeOnGraph).toHaveBeenCalledWith(mockLeafNodeDef)
    })

    it('toggles node expansion when a folder node is clicked', async () => {
      const root = await renderAndGetRoot()
      const folderNode = root.children?.[0]
      const mockEvent = new MouseEvent('click')

      await folderNode?.handleClick?.call(folderNode, mockEvent)

      expect(mockToggleNodeOnEvent).toHaveBeenCalledWith(
        mockEvent,
        expect.objectContaining({ key: folderNode?.key })
      )
    })
  })

  describe('handleDelete', () => {
    it('deletes the bookmark folder when node data is present', async () => {
      const root = await renderAndGetRoot()
      const folderNode = root.children?.[0]

      await folderNode?.handleDelete?.call({
        ...folderNode,
        data: mockFolderNodeDef
      })

      expect(mockDeleteBookmarkFolder).toHaveBeenCalledWith(mockFolderNodeDef)
    })

    it('is a no-op when node data is missing', async () => {
      const root = await renderAndGetRoot()
      const folderNode = root.children?.[0]

      await folderNode?.handleDelete?.call({ ...folderNode, data: undefined })

      expect(mockDeleteBookmarkFolder).not.toHaveBeenCalled()
    })
  })
})
