import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import type { LGraphGroup } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { isLGraphGroup } from '@/utils/litegraphUtil'

import {
  buildStructuredMenu,
  convertContextMenuToOptions
} from './contextMenuConverter'
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
  type?: 'divider' | 'category'
  action?: () => void
  submenu?: SubMenuOption[]
  badge?: BadgeVariant
  disabled?: boolean
  source?: 'litegraph' | 'vue'
}

export interface SubMenuOption {
  label: string
  icon?: string
  action: () => void
  color?: string
  disabled?: boolean
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
 * Mark menu options as coming from Vue hardcoded menu
 */
function markAsVueOptions(options: MenuOption[]): MenuOption[] {
  return options.map((opt) => {
    // Don't mark dividers or category labels
    if (opt.type === 'divider' || opt.type === 'category') {
      return opt
    }
    return { ...opt, source: 'vue' }
  })
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

  const canvasStore = useCanvasStore()

  const { getImageMenuOptions } = useImageMenuOptions()
  const {
    getNodeInfoOption,
    getNodeVisualOptions,
    getPinOption,
    getBypassOption,
    getRunBranchOption
  } = useNodeMenuOptions()
  const {
    getFitGroupToNodesOption,
    getGroupColorOptions,
    getGroupModeOptions
  } = useGroupMenuOptions()
  const {
    getBasicSelectionOptions,
    getSubgraphOptions,
    getMultipleNodesOptions
  } = useSelectionMenuOptions()

  const hasSubgraphs = hasSubgraphsComputed
  const hasMultipleNodes = hasMultipleSelection

  // Internal version to force menu rebuild after state mutations
  const optionsVersion = ref(0)
  const bump = () => {
    optionsVersion.value++
  }

  const menuOptions = computed((): MenuOption[] => {
    /* eslint-disable no-console */
    // Reference selection flags to ensure re-computation when they change

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

    // For single node selection, also get LiteGraph menu items to merge
    const litegraphOptions: MenuOption[] = []
    if (
      selectedNodes.value.length === 1 &&
      !groupContext &&
      canvasStore.canvas
    ) {
      try {
        const node = selectedNodes.value[0]
        const rawItems = canvasStore.canvas.getNodeMenuOptions(node)
        // Don't apply structuring yet - we'll do it after merging with Vue options
        litegraphOptions.push(
          ...convertContextMenuToOptions(rawItems, node, false)
        )
      } catch (error) {
        console.error('Error getting LiteGraph menu items:', error)
      }
    }

    const options: MenuOption[] = []

    console.log('[Menu] Building menu sections...')

    // Section 1: Basic selection operations (Rename, Copy, Duplicate)
    const basicOps = getBasicSelectionOptions()
    console.log(
      '[Menu] Section 1 - Basic operations:',
      basicOps.map((o) => o.label)
    )
    options.push(...basicOps)
    options.push({ type: 'divider' })

    // Section 2: Node actions (Run Branch, Pin, Bypass, Mute)
    console.log('[Menu] Section 2 - Node actions...')
    if (hasOutputNodesSelected.value) {
      const runBranch = getRunBranchOption()
      console.log('[Menu]   - Run Branch:', runBranch.label)
      options.push(runBranch)
    }
    if (!groupContext) {
      const pin = getPinOption(states, bump)
      const bypass = getBypassOption(states, bump)
      console.log('[Menu]   - Pin:', pin.label)
      console.log('[Menu]   - Bypass:', bypass.label)
      options.push(pin)
      options.push(bypass)
    }
    if (groupContext) {
      const groupModes = getGroupModeOptions(groupContext, bump)
      console.log(
        '[Menu]   - Group modes:',
        groupModes.map((o) => o.label)
      )
      options.push(...groupModes)
    }
    options.push({ type: 'divider' })

    // Section 3: Structure operations (Convert to Subgraph, Frame selection, Minimize Node)
    console.log('[Menu] Section 3 - Structure operations...')
    const subgraphOps = getSubgraphOptions(hasSubgraphsSelected)
    console.log(
      '[Menu]   - Subgraph:',
      subgraphOps.map((o) => o.label)
    )
    options.push(...subgraphOps)
    if (hasMultipleNodes.value) {
      const multiOps = getMultipleNodesOptions()
      console.log(
        '[Menu]   - Multiple nodes:',
        multiOps.map((o) => o.label)
      )
      options.push(...multiOps)
    }
    if (groupContext) {
      const fitGroup = getFitGroupToNodesOption(groupContext)
      console.log('[Menu]   - Fit group:', fitGroup.label)
      options.push(fitGroup)
    } else {
      // Add minimize/expand option only
      const visualOptions = getNodeVisualOptions(states, bump)
      if (visualOptions.length > 0) {
        console.log('[Menu]   - Minimize/Expand:', visualOptions[0].label)
        options.push(visualOptions[0]) // Minimize/Expand
      }
    }
    options.push({ type: 'divider' })

    // Section 4: Node properties (Node Info, Color)
    console.log('[Menu] Section 4 - Node properties...')
    if (nodeDef.value) {
      const nodeInfo = getNodeInfoOption(showNodeHelp)
      console.log('[Menu]   - Node Info:', nodeInfo.label)
      options.push(nodeInfo)
    }
    if (groupContext) {
      const groupColor = getGroupColorOptions(groupContext, bump)
      console.log('[Menu]   - Group Color:', groupColor.label)
      options.push(groupColor)
    } else {
      // Add color option only (not shape)
      const visualOptions = getNodeVisualOptions(states, bump)
      if (visualOptions.length > 2) {
        console.log('[Menu]   - Color:', visualOptions[2].label)
        options.push(visualOptions[2]) // Color (index 2)
      }
    }
    options.push({ type: 'divider' })

    // Section 5: Node-specific options (image operations)
    if (hasImageNode.value && selectedNodes.value.length > 0) {
      const imageOps = getImageMenuOptions(selectedNodes.value[0])
      console.log(
        '[Menu] Section 5 - Image operations:',
        imageOps.map((o) => o.label)
      )
      options.push(...imageOps)
      options.push({ type: 'divider' })
    }

    console.log('[Menu] Total Vue options before marking:', options.length)

    // Section 6 & 7: Extensions and Delete are handled by buildStructuredMenu

    // Mark all Vue options with source
    const markedVueOptions = markAsVueOptions(options)
    console.log('[Menu] Marked Vue options:', markedVueOptions.length)

    // For single node selection, merge LiteGraph options with Vue options
    // Vue options will take precedence during deduplication in buildStructuredMenu
    if (litegraphOptions.length > 0) {
      console.log(
        '[Menu] Merging with LiteGraph options:',
        litegraphOptions.length
      )
      console.log(
        '[Menu] LiteGraph items:',
        litegraphOptions.map((o) => o.label || o.type)
      )
      // Merge: LiteGraph options first, then Vue options (Vue will win in dedup)
      const merged = [...litegraphOptions, ...markedVueOptions]
      console.log('[Menu] Merged total:', merged.length)
      // Now apply structuring (which includes deduplication with Vue precedence)
      return buildStructuredMenu(merged)
    }

    console.log('[Menu] No LiteGraph options, using Vue only')
    // For other cases, structure the Vue options
    const result = buildStructuredMenu(markedVueOptions)
    /* eslint-enable no-console */
    return result
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
