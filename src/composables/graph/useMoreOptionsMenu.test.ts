import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isNodeOptionsOpen,
  registerNodeOptionsInstance,
  showNodeOptions,
  toggleNodeOptions,
  useMoreOptionsMenu
} from '@/composables/graph/useMoreOptionsMenu'

// Plain { value } objects stand in for refs — vi.hoisted runs before imports,
// so vue's ref isn't available here; the composable only reads `.value`.
const { selectionState } = vi.hoisted(() => ({
  selectionState: {
    selectedItems: { value: [] as unknown[] },
    selectedNodes: { value: [] as unknown[] },
    canOpenNodeInfo: { value: false },
    openNodeInfo: vi.fn(),
    hasSubgraphs: { value: false },
    hasImageNode: { value: false },
    hasOutputNodesSelected: { value: false },
    hasMultipleSelection: { value: false },
    computeSelectionFlags: vi.fn(() => ({}))
  }
}))

vi.mock('@/composables/graph/useSelectionState', () => ({
  useSelectionState: () => selectionState
}))
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ canvas: undefined })
}))
vi.mock('@/services/litegraphService', () => ({
  getExtraOptionsForWidget: () => []
}))
vi.mock('@/composables/graph/useImageMenuOptions', () => ({
  useImageMenuOptions: () => ({ getImageMenuOptions: () => [] })
}))
vi.mock('@/composables/graph/useNodeMenuOptions', () => ({
  useNodeMenuOptions: () => ({
    getNodeInfoOption: () => ({ label: 'Info' }),
    getNodeVisualOptions: () => [],
    getPinOption: () => ({ label: 'Pin' }),
    getBypassOption: () => ({ label: 'Bypass' }),
    getRunBranchOption: () => ({ label: 'Run Branch' })
  })
}))
vi.mock('@/composables/graph/useGroupMenuOptions', () => ({
  useGroupMenuOptions: () => ({
    getFitGroupToNodesOption: () => ({ label: 'Fit' }),
    getGroupColorOptions: () => ({ label: 'Group Color' }),
    getGroupModeOptions: () => []
  })
}))
vi.mock('@/composables/graph/useSelectionMenuOptions', () => ({
  useSelectionMenuOptions: () => ({
    getBasicSelectionOptions: () => [{ label: 'Copy' }],
    getMultipleNodesOptions: () => [{ label: 'Align' }],
    getSubgraphOptions: () => []
  })
}))

beforeEach(() => {
  registerNodeOptionsInstance(null)
  selectionState.selectedItems.value = []
  selectionState.selectedNodes.value = []
  selectionState.hasOutputNodesSelected.value = false
  selectionState.hasMultipleSelection.value = false
})

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

  it('no-ops toggle/show when no instance is registered', () => {
    expect(() => toggleNodeOptions(new Event('click'))).not.toThrow()
    expect(() => showNodeOptions(new MouseEvent('contextmenu'))).not.toThrow()
  })
})

describe('useMoreOptionsMenu', () => {
  it('assembles a non-empty menu for a single selected node', () => {
    const node = { id: 1, widgets: [] }
    selectionState.selectedItems.value = [node]
    selectionState.selectedNodes.value = [node]

    const { menuOptions } = useMoreOptionsMenu()
    const labels = menuOptions.value.map((o) => o.label)
    expect(labels).toContain('Copy')
    expect(labels).toContain('Pin')
  })

  it('includes multiple-node options when several nodes are selected', () => {
    const nodes = [
      { id: 1, widgets: [] },
      { id: 2, widgets: [] }
    ]
    selectionState.selectedItems.value = nodes
    selectionState.selectedNodes.value = nodes
    selectionState.hasMultipleSelection.value = true

    const { menuOptions } = useMoreOptionsMenu()
    expect(menuOptions.value.map((o) => o.label)).toContain('Align')
  })

  it('bumps the options version to force recompute', () => {
    const { bump, menuOptions } = useMoreOptionsMenu()
    expect(() => {
      bump()
      void menuOptions.value
    }).not.toThrow()
  })
})
