import { computed, ref } from 'vue'
import type { Ref } from 'vue'

import type { LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { getExtraOptionsForWidget } from '@/services/litegraphService'
import type { SerializedNodeId } from '@/types/nodeId'
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
  isColorPicker?: boolean
  isShapePicker?: boolean
}

export interface SubMenuOption {
  label: string
  icon?: string
  action: () => void
  color?: string
  disabled?: boolean
}

export enum BadgeVariant {
  NEW = 'new'
}

// Global singleton for NodeOptions component reference
let nodeOptionsInstance: null | NodeOptionsInstance = null

interface NodeMenuContext {
  widgetName?: string
  widgetNodeId?: SerializedNodeId
  contextualActionsDisabled: boolean
}

const nodeMenuContext = ref<NodeMenuContext>()

const LEGACY_IMAGE_MENU_LABELS = new Set([
  'Open Image',
  'Copy Image',
  'Paste Image',
  'Paste (Clipspace)',
  'Save Image',
  'Open in Mask Editor',
  'Open in MaskEditor | Image Canvas'
])

/**
 * Toggle the node options popover
 * @param event - The trigger event
 */
export function toggleNodeOptions(event: Event) {
  nodeMenuContext.value = undefined
  if (nodeOptionsInstance?.toggle) {
    nodeOptionsInstance.toggle(event)
  }
}

/**
 * Show the node options popover (always shows, doesn't toggle)
 * Use this for contextmenu events where we always want to show at the new position
 * @param event - The trigger event (must be MouseEvent for position)
 */
export function showNodeOptions(
  event: MouseEvent,
  widgetName?: string,
  widgetNodeId?: SerializedNodeId,
  contextualActionsDisabled = false
) {
  nodeMenuContext.value =
    widgetName || contextualActionsDisabled
      ? { widgetName, widgetNodeId, contextualActionsDisabled }
      : undefined
  if (nodeOptionsInstance?.show) {
    nodeOptionsInstance.show(event)
  }
}

/**
 * Check if the node options menu is currently open
 */
export function isNodeOptionsOpen(): boolean {
  return nodeOptionsInstance?.isOpen.value ?? false
}

interface NodeOptionsInstance {
  toggle: (event: Event) => void
  show: (event: MouseEvent) => void
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
    canOpenNodeInfo,
    openNodeInfo,
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
    getMultipleNodesOptions,
    getSubgraphOptions
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
    void optionsVersion.value
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
    const node: LGraphNode | undefined = selectedNodes.value[0]
    const menuContext = nodeMenuContext.value
    const widget = menuContext?.widgetName
      ? node?.widgets?.find((item) => item.name === menuContext.widgetName)
      : undefined
    if (
      selectedNodes.value.length === 1 &&
      !groupContext &&
      canvasStore.canvas
    ) {
      try {
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

    // Section 1: Basic selection operations (Rename, Copy, Duplicate)
    const basicOps = getBasicSelectionOptions()
    options.push(...basicOps)
    options.push({ type: 'divider' })

    // Section 2: Node actions (Run Branch, Pin, Bypass, Mute)
    if (hasOutputNodesSelected.value) {
      const runBranch = getRunBranchOption()
      options.push(runBranch)
    }
    if (!groupContext) {
      const pin = getPinOption(states, bump)
      const bypass = getBypassOption(bump)
      options.push(pin)
      options.push(bypass)
    }
    if (groupContext) {
      const groupModes = getGroupModeOptions(groupContext, bump)
      options.push(...groupModes)
    }
    options.push({ type: 'divider' })

    // Section 3: Structure operations (Convert to Subgraph, Frame selection, Minimize Node)
    options.push(
      ...getSubgraphOptions({
        hasSubgraphs: hasSubgraphsSelected,
        hasMultipleSelection: hasMultipleNodes.value
      })
    )
    if (hasMultipleNodes.value) {
      options.push(...getMultipleNodesOptions())
    }
    if (groupContext) {
      options.push(getFitGroupToNodesOption(groupContext))
    } else {
      // Node context: Expand/Minimize
      const visualOptions = getNodeVisualOptions(states, bump)
      if (visualOptions.length > 0) {
        options.push(visualOptions[0]) // Expand/Minimize (index 0)
      }
    }
    options.push({ type: 'divider' })

    // Section 4: Node properties (Node Info, Shape, Color)
    if (canOpenNodeInfo.value) {
      options.push(getNodeInfoOption(openNodeInfo))
    }
    if (groupContext) {
      options.push(getGroupColorOptions(groupContext, bump))
    } else {
      // Add shape and color options
      const visualOptions = getNodeVisualOptions(states, bump)
      if (visualOptions.length > 1) {
        options.push(visualOptions[1]) // Shape (index 1)
      }
      if (visualOptions.length > 2) {
        options.push(visualOptions[2]) // Color (index 2)
      }
    }
    options.push({ type: 'divider' })

    // Section 5: Image operations (if image node)
    if (
      !menuContext?.contextualActionsDisabled &&
      hasImageNode.value &&
      selectedNodes.value.length > 0
    ) {
      options.push(...getImageMenuOptions(selectedNodes.value[0]))
      options.push({ type: 'divider' })
    }
    if (widget && !menuContext?.contextualActionsDisabled) {
      const widgetOptions = convertContextMenuToOptions(
        getExtraOptionsForWidget(node, widget)
      )
      if (widgetOptions) {
        options.push(...widgetOptions)
        options.push({ type: 'divider' })
      }
    }

    // Section 6 & 7: Extensions and Delete are handled by buildStructuredMenu

    // Mark all Vue options with source
    const markedVueOptions = markAsVueOptions(options)

    const suppressedLabels = new Set(LEGACY_IMAGE_MENU_LABELS)
    if (menuContext?.contextualActionsDisabled && node && widget) {
      for (const option of getExtraOptionsForWidget(node, widget)) {
        if (option.content) suppressedLabels.add(option.content)
      }
    }
    const visibleLitegraphOptions = menuContext?.contextualActionsDisabled
      ? litegraphOptions.filter(
          (option) => !option.label || !suppressedLabels.has(option.label)
        )
      : litegraphOptions

    if (visibleLitegraphOptions.length > 0) {
      // Merge: LiteGraph options first, then Vue options (Vue will win in dedup)
      const merged = [...visibleLitegraphOptions, ...markedVueOptions]
      return buildStructuredMenu(merged)
    }
    // For other cases, structure the Vue options
    const result = buildStructuredMenu(markedVueOptions)
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
