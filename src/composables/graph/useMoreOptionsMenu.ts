import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import type { LGraphGroup } from '@/lib/litegraph/src/litegraph'
import { isLGraphGroup } from '@/utils/litegraphUtil'

import { useGroupMenuOptions } from './useGroupMenuOptions'
import { useImageMenuOptions } from './useImageMenuOptions'
import { useNodeMenuOptions } from './useNodeMenuOptions'
import { useSelectionMenuOptions } from './useSelectionMenuOptions'
import { useSelectionState } from './useSelectionState'

export interface MenuOption {
  label?: string
  icon?: string
  shortcut?: string
  hasSubmenu?: boolean
  type?: 'divider'
  action?: () => void
  submenu?: SubMenuOption[]
  badge?: BadgeVariant
}

export interface SubMenuOption {
  label: string
  icon?: string
  action: () => void
  color?: string
}

export enum BadgeVariant {
  NEW = 'new',
  DEPRECATED = 'deprecated'
}

// Global singleton for NodeOptions component reference
let nodeOptionsInstance: null | NodeOptionsInstance = null

/**
 * Toggle the node options popover
 * @param event - The trigger event
 * @param element - The target element (button) that triggered the popover
 */
export function toggleNodeOptions(
  event: Event,
  element: HTMLElement,
  clickedFromToolbox: boolean = false
) {
  if (nodeOptionsInstance?.toggle) {
    nodeOptionsInstance.toggle(event, element, clickedFromToolbox)
  }
}

/**
 * Hide the node options popover
 */
interface NodeOptionsInstance {
  toggle: (
    event: Event,
    element: HTMLElement,
    clickedFromToolbox: boolean
  ) => void
  hide: () => void
  isOpen: Ref<boolean>
}

/**
 * Register the NodeOptions component instance
 * @param instance - The NodeOptions component instance
 */
export function registerNodeOptionsInstance(
  instance: null | NodeOptionsInstance
) {
  nodeOptionsInstance = instance
}

/**
 * Composable for managing the More Options menu configuration
 * Refactored to use smaller, focused composables for better maintainability
 */
export function useMoreOptionsMenu() {
  const {
    selectedItems,
    selectedNodes,
    nodeDef,
    showNodeHelp,
    hasSubgraphs: hasSubgraphsComputed,
    hasImageNode,
    hasOutputNodesSelected,
    hasMultipleSelection,
    computeSelectionFlags
  } = useSelectionState()

  const { getImageMenuOptions } = useImageMenuOptions()
  const {
    getNodeInfoOption,
    getAdjustSizeOption,
    getNodeVisualOptions,
    getPinOption,
    getBypassOption,
    getRunBranchOption
  } = useNodeMenuOptions()
  const {
    getFitGroupToNodesOption,
    getGroupShapeOptions,
    getGroupColorOptions,
    getGroupModeOptions
  } = useGroupMenuOptions()
  const {
    getBasicSelectionOptions,
    getSubgraphOptions,
    getMultipleNodesOptions,
    getDeleteOption,
    getAlignmentOptions
  } = useSelectionMenuOptions()

  const hasSubgraphs = hasSubgraphsComputed
  const hasMultipleNodes = hasMultipleSelection

  // Internal version to force menu rebuild after state mutations
  const optionsVersion = ref(0)
  const bump = () => {
    optionsVersion.value++
  }

  const menuOptions = computed((): MenuOption[] => {
    // Reference selection flags to ensure re-computation when they change
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    optionsVersion.value
    const states = computeSelectionFlags()

    // Detect single group selection context (and no nodes explicitly selected)
    const selectedGroups = selectedItems.value.filter(
      isLGraphGroup
    ) as LGraphGroup[]
    const groupContext: LGraphGroup | null =
      selectedGroups.length === 1 && selectedNodes.value.length === 0
        ? selectedGroups[0]
        : null
    const hasSubgraphsSelected = hasSubgraphs.value
    const options: MenuOption[] = []

    // Section 1: Basic selection operations (Rename, Copy, Duplicate)
    options.push(...getBasicSelectionOptions())
    options.push({ type: 'divider' })

    // Section 2: Node Info & Size Adjustment
    if (nodeDef.value) {
      options.push(getNodeInfoOption(showNodeHelp))
    }

    if (groupContext) {
      options.push(getFitGroupToNodesOption(groupContext))
    } else {
      options.push(getAdjustSizeOption())
    }

    // Section 3: Collapse/Shape/Color
    if (groupContext) {
      // Group context: Shape, Color, Divider
      options.push(getGroupShapeOptions(groupContext, bump))
      options.push(getGroupColorOptions(groupContext, bump))
      options.push({ type: 'divider' })
    } else {
      // Node context: Expand/Minimize, Shape, Color, Divider
      options.push(...getNodeVisualOptions(states, bump))
      options.push({ type: 'divider' })
    }

    // Section 4: Image operations (if image node)
    if (hasImageNode.value && selectedNodes.value.length > 0) {
      options.push(...getImageMenuOptions(selectedNodes.value[0]))
    }

    // Section 5: Subgraph operations
    options.push(...getSubgraphOptions(hasSubgraphsSelected))

    // Section 6: Multiple nodes operations
    if (hasMultipleNodes.value) {
      options.push(...getMultipleNodesOptions())
    }

    // Section 7: Divider
    options.push({ type: 'divider' })

    // Section 8: Pin/Unpin (non-group only)
    if (!groupContext) {
      options.push(getPinOption(states, bump))
    }

    // Section 9: Alignment (if multiple nodes)
    if (hasMultipleNodes.value) {
      options.push(...getAlignmentOptions())
    }

    // Section 10: Mode operations
    if (groupContext) {
      // Group mode operations
      options.push(...getGroupModeOptions(groupContext, bump))
    } else {
      // Bypass option for nodes
      options.push(getBypassOption(states, bump))
    }

    // Section 11: Run Branch (if output nodes)
    if (hasOutputNodesSelected.value) {
      options.push(getRunBranchOption())
    }

    // Section 12: Final divider and Delete
    options.push({ type: 'divider' })
    options.push(getDeleteOption())

    return options
  })

  // Computed property to get only menu items with submenus
  const menuOptionsWithSubmenu = computed(() =>
    menuOptions.value.filter((option) => option.hasSubmenu && option.submenu)
  )

  return {
    menuOptions,
    menuOptionsWithSubmenu,
    bump,
    hasSubgraphs,
    registerNodeOptionsInstance
  }
}
