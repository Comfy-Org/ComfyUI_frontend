import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  showNodeOptions,
  toggleNodeOptions,
  useMoreOptionsMenu
} from '@/composables/graph/useMoreOptionsMenu'

const selectedItems = ref([{ id: 'node-1' }, { id: 'node-2' }])
const selectedNodes = ref([{ id: 'node-1' }, { id: 'node-2' }])

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: null
  })
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphGroup: () => false
}))

vi.mock('@/composables/graph/useSelectionState', () => ({
  useSelectionState: () => ({
    selectedItems: computed(() => selectedItems.value),
    selectedNodes: computed(() => selectedNodes.value),
    nodeDef: computed(() => null),
    showNodeHelp: vi.fn(),
    hasSubgraphs: computed(() => false),
    hasImageNode: computed(() => false),
    hasOutputNodesSelected: computed(() => false),
    hasMultipleSelection: computed(() => true),
    computeSelectionFlags: () => ({
      collapsed: false,
      pinned: false,
      bypassed: false
    })
  })
}))

vi.mock('@/composables/graph/useImageMenuOptions', () => ({
  useImageMenuOptions: () => ({
    getImageMenuOptions: () => []
  })
}))

vi.mock('@/composables/graph/useNodeMenuOptions', () => ({
  useNodeMenuOptions: () => ({
    getNodeInfoOption: () => ({ label: 'Node Info' }),
    getNodeVisualOptions: () => [],
    getPinOption: () => ({ label: 'Pin' }),
    getBypassOption: () => ({ label: 'Bypass' }),
    getRunBranchOption: () => ({ label: 'Run Branch' })
  })
}))

vi.mock('@/composables/graph/useGroupMenuOptions', () => ({
  useGroupMenuOptions: () => ({
    getFitGroupToNodesOption: () => ({ label: 'Fit Group to Nodes' }),
    getGroupColorOptions: () => ({ label: 'Group Color' }),
    getGroupModeOptions: () => []
  })
}))

vi.mock('@/composables/graph/useSelectionMenuOptions', () => ({
  useSelectionMenuOptions: () => ({
    getBasicSelectionOptions: () => [{ label: 'Rename' }],
    getMultipleNodesOptions: () => [{ label: 'Frame Nodes' }],
    getSubgraphOptions: () => [],
    getAlignmentOptions: () => [{ label: 'Align Selected To' }]
  })
}))

vi.mock('@/core/graph/subgraph/promotedWidgetTypes', () => ({
  isPromotedWidgetView: () => false
}))

vi.mock('@/services/litegraphService', () => ({
  getExtraOptionsForWidget: () => []
}))

describe('useMoreOptionsMenu', () => {
  beforeEach(() => {
    selectedItems.value = [{ id: 'node-1' }, { id: 'node-2' }]
    selectedNodes.value = [{ id: 'node-1' }, { id: 'node-2' }]
    toggleNodeOptions(new Event('click'), 'toolbar')
  })

  it('adds alignment options for right-click menus only', () => {
    const { menuOptions } = useMoreOptionsMenu()

    expect(
      menuOptions.value.some((option) => option.label === 'Align Selected To')
    ).toBe(false)

    showNodeOptions(new MouseEvent('contextmenu'))

    expect(
      menuOptions.value.some((option) => option.label === 'Align Selected To')
    ).toBe(true)

    toggleNodeOptions(new Event('click'), 'toolbar')

    expect(
      menuOptions.value.some((option) => option.label === 'Align Selected To')
    ).toBe(false)
  })
})
