import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphGroup } from '@/lib/litegraph/src/litegraph'
import {
  isNodeOptionsOpen,
  registerNodeOptionsInstance,
  showNodeOptions,
  toggleNodeOptions,
  useMoreOptionsMenu
} from '@/composables/graph/useMoreOptionsMenu'

const {
  canvasState,
  extraWidgetOptions,
  imageOptions,
  nodeMenu,
  selectionMenu,
  selectionState
} = vi.hoisted(() => ({
  canvasState: {
    canvas: undefined as
      | undefined
      | {
          getNodeMenuOptions: ReturnType<typeof vi.fn>
        }
  },
  extraWidgetOptions: {
    value: [] as Array<{ content: string; callback?: () => void }>
  },
  imageOptions: {
    value: [] as Array<{ label: string; hasSubmenu?: boolean; submenu?: [] }>
  },
  nodeMenu: {
    visualOptions: {
      value: [] as Array<{
        label: string
        hasSubmenu?: boolean
        submenu?: Array<{ label: string; action: () => void }>
      }>
    }
  },
  selectionMenu: {
    basicOptions: { value: [{ label: 'Copy' }] },
    multipleOptions: { value: [{ label: 'Align' }] },
    subgraphOptions: { value: [] as Array<{ label: string }> }
  },
  selectionState: {
    selectedItems: { value: [] as unknown[] },
    selectedNodes: { value: [] as unknown[] },
    canOpenNodeInfo: { value: false },
    openNodeInfo: vi.fn(() => true),
    hasSubgraphs: { value: false },
    hasImageNode: { value: false },
    hasOutputNodesSelected: { value: false },
    hasMultipleSelection: { value: false },
    computeSelectionFlags: vi.fn(() => ({
      collapsed: false,
      pinned: false
    }))
  }
}))

vi.mock('@/composables/graph/useSelectionState', () => ({
  useSelectionState: () => selectionState
}))
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => canvasState
}))
vi.mock('@/services/litegraphService', () => ({
  getExtraOptionsForWidget: () => extraWidgetOptions.value
}))
vi.mock('@/composables/graph/useImageMenuOptions', () => ({
  useImageMenuOptions: () => ({
    getImageMenuOptions: () => imageOptions.value
  })
}))
vi.mock('@/composables/graph/useNodeMenuOptions', () => ({
  useNodeMenuOptions: () => ({
    getNodeInfoOption: (openNodeInfo: () => boolean) => ({
      label: 'Node Info',
      action: openNodeInfo
    }),
    getNodeVisualOptions: () => nodeMenu.visualOptions.value,
    getPinOption: () => ({ label: 'Pin' }),
    getBypassOption: () => ({ label: 'Bypass' }),
    getRunBranchOption: () => ({ label: 'Run Branch' })
  })
}))
vi.mock('@/composables/graph/useGroupMenuOptions', () => ({
  useGroupMenuOptions: () => ({
    getFitGroupToNodesOption: () => ({ label: 'Fit' }),
    getGroupColorOptions: () => ({ label: 'Group Color' }),
    getGroupModeOptions: () => [{ label: 'Group Mode' }]
  })
}))
vi.mock('@/composables/graph/useSelectionMenuOptions', () => ({
  useSelectionMenuOptions: () => ({
    getBasicSelectionOptions: () => selectionMenu.basicOptions.value,
    getMultipleNodesOptions: () => selectionMenu.multipleOptions.value,
    getSubgraphOptions: () => selectionMenu.subgraphOptions.value
  })
}))

beforeEach(() => {
  vi.clearAllMocks()
  registerNodeOptionsInstance(null)
  canvasState.canvas = undefined
  extraWidgetOptions.value = []
  imageOptions.value = []
  nodeMenu.visualOptions.value = []
  selectionMenu.basicOptions.value = [{ label: 'Copy' }]
  selectionMenu.multipleOptions.value = [{ label: 'Align' }]
  selectionMenu.subgraphOptions.value = []
  selectionState.selectedItems.value = []
  selectionState.selectedNodes.value = []
  selectionState.canOpenNodeInfo.value = false
  selectionState.hasSubgraphs.value = false
  selectionState.hasImageNode.value = false
  selectionState.hasOutputNodesSelected.value = false
  selectionState.hasMultipleSelection.value = false
  selectionState.computeSelectionFlags.mockReturnValue({
    collapsed: false,
    pinned: false
  })
})

function labels() {
  return useMoreOptionsMenu()
    .menuOptions.value.map((o) => o.label)
    .filter(Boolean)
}

describe('node options popover instance', () => {
  it('reports closed when no instance is registered', () => {
    expect(isNodeOptionsOpen()).toBe(false)
  })

  it('reflects the registered instance open state and forwards toggle/show', () => {
    const toggle = vi.fn()
    const show = vi.fn()
    registerNodeOptionsInstance({
      toggle,
      show,
      hide: vi.fn(),
      isOpen: ref(true)
    })

    expect(isNodeOptionsOpen()).toBe(true)
    toggleNodeOptions(new Event('click'))
    showNodeOptions(new MouseEvent('contextmenu'))
    expect(toggle).toHaveBeenCalled()
    expect(show).toHaveBeenCalled()
  })
})

describe('useMoreOptionsMenu', () => {
  it('assembles a non-empty menu for a single selected node', () => {
    const node = { id: 1, widgets: [] }
    selectionState.selectedItems.value = [node]
    selectionState.selectedNodes.value = [node]

    expect(labels()).toContain('Copy')
    expect(labels()).toContain('Pin')
  })

  it('includes run-branch and multiple-node options for output selections', () => {
    const nodes = [
      { id: 1, widgets: [] },
      { id: 2, widgets: [] }
    ]
    selectionState.selectedItems.value = nodes
    selectionState.selectedNodes.value = nodes
    selectionState.hasOutputNodesSelected.value = true
    selectionState.hasMultipleSelection.value = true

    const menuLabels = labels()
    expect(menuLabels).toContain('Run Branch')
    expect(menuLabels).toContain('Align')
  })

  it('recomputes menu flags after a manual bump', () => {
    const { bump, menuOptions } = useMoreOptionsMenu()
    void menuOptions.value
    expect(selectionState.computeSelectionFlags).toHaveBeenCalledTimes(1)

    bump()
    void menuOptions.value
    expect(selectionState.computeSelectionFlags).toHaveBeenCalledTimes(2)
  })

  it('assembles group-context options for a single selected group', () => {
    const group = new LGraphGroup('Group')
    selectionState.selectedItems.value = [group]
    selectionState.selectedNodes.value = []

    const menuLabels = labels()
    expect(menuLabels).toContain('Group Mode')
    expect(menuLabels).toContain('Fit')
    expect(menuLabels).toContain('Group Color')
  })

  it('includes node info and visual options for a single node', () => {
    const node = { id: 1, widgets: [] }
    selectionState.selectedItems.value = [node]
    selectionState.selectedNodes.value = [node]
    selectionState.canOpenNodeInfo.value = true
    nodeMenu.visualOptions.value = [
      { label: 'Minimize Node' },
      { label: 'Shape', hasSubmenu: true, submenu: [] },
      { label: 'Color', hasSubmenu: true, submenu: [] }
    ]

    const menu = useMoreOptionsMenu().menuOptions.value
    expect(menu.map((o) => o.label)).toEqual(
      expect.arrayContaining(['Node Info', 'Minimize Node', 'Shape', 'Color'])
    )
    menu.find((o) => o.label === 'Node Info')?.action?.()
    expect(selectionState.openNodeInfo).toHaveBeenCalled()
  })

  it('returns only entries that have populated submenus', () => {
    const node = { id: 1, widgets: [] }
    selectionState.selectedItems.value = [node]
    selectionState.selectedNodes.value = [node]
    nodeMenu.visualOptions.value = [
      { label: 'Minimize Node' },
      {
        label: 'Shape',
        hasSubmenu: true,
        submenu: [{ label: 'Box', action: vi.fn() }]
      },
      { label: 'Color', hasSubmenu: true }
    ]

    expect(
      useMoreOptionsMenu().menuOptionsWithSubmenu.value.map((o) => o.label)
    ).toEqual(['Shape'])
  })

  it('includes image menu options for a selected image node', () => {
    const node = { id: 1, widgets: [] }
    selectionState.selectedItems.value = [node]
    selectionState.selectedNodes.value = [node]
    selectionState.hasImageNode.value = true
    imageOptions.value = [{ label: 'Open Image' }]

    expect(labels()).toContain('Open Image')
  })

  it('merges LiteGraph menu options for a single selected node', () => {
    const node = { id: 1, widgets: [] }
    const getNodeMenuOptions = vi.fn(() => [
      { content: 'Extension Action', callback: vi.fn() }
    ])
    selectionState.selectedItems.value = [node]
    selectionState.selectedNodes.value = [node]
    canvasState.canvas = { getNodeMenuOptions }

    expect(labels()).toContain('Extension Action')
    expect(getNodeMenuOptions).toHaveBeenCalledWith(node)
  })

  it('keeps Vue options when LiteGraph menu construction throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const node = { id: 1, widgets: [] }
    selectionState.selectedItems.value = [node]
    selectionState.selectedNodes.value = [node]
    canvasState.canvas = {
      getNodeMenuOptions: vi.fn(() => {
        throw new Error('boom')
      })
    }

    expect(labels()).toContain('Copy')
    expect(errorSpy).toHaveBeenCalledWith(
      'Error getting LiteGraph menu items:',
      expect.any(Error)
    )

    errorSpy.mockRestore()
  })

  it('adds hovered widget options to the selected node menu', () => {
    const node = { id: 1, widgets: [{ name: 'image' }] }
    selectionState.selectedItems.value = [node]
    selectionState.selectedNodes.value = [node]
    extraWidgetOptions.value = [{ content: 'Widget Extra', callback: vi.fn() }]

    showNodeOptions(new MouseEvent('contextmenu'), 'image')

    expect(labels()).toContain('Widget Extra')
  })
})
