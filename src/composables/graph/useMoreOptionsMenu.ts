import { type Component, computed, markRaw } from 'vue'
// Import icons
import ILucideBan from '~icons/lucide/ban'
import ILucideBox from '~icons/lucide/box'
import ILucideExpand from '~icons/lucide/expand'
import ILucideFolderPlus from '~icons/lucide/folder-plus'
import ILucideInfo from '~icons/lucide/info'
import ILucideMaximize2 from '~icons/lucide/maximize-2'
import ILucideMinimize2 from '~icons/lucide/minimize-2'
import ILucideMoveDiagonal2 from '~icons/lucide/move-diagonal-2'
import ILucidePalette from '~icons/lucide/palette'
import ILucidePin from '~icons/lucide/pin'
import ILucidePinOff from '~icons/lucide/pin-off'
import ILucidePlay from '~icons/lucide/play'
import ILucideShrink from '~icons/lucide/shrink'
import ILucideTrash2 from '~icons/lucide/trash-2'
import ILucideZapOff from '~icons/lucide/zap-off'

import { useNodeCustomization } from '@/composables/graph/useNodeCustomization'
import { useNodeInfo } from '@/composables/graph/useNodeInfo'
import { useSelectionOperations } from '@/composables/graph/useSelectionOperations'
import { useSubgraphOperations } from '@/composables/graph/useSubgraphOperations'
import { useNodeLibrarySidebarTab } from '@/composables/sidebarTabs/useNodeLibrarySidebarTab'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  LGraphEventMode,
  LGraphNode,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { adjustColor } from '@/utils/colorUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'

export interface MenuOption {
  label?: string
  icon?: Component
  shortcut?: string
  hasSubmenu?: boolean
  type?: 'divider'
  action?: () => void
  submenu?: SubMenuOption[]
}

export interface SubMenuOption {
  label: string
  icon?: Component
  action: () => void
  color?: string
}

export interface NodeSelectionState {
  collapsed: boolean
  pinned: boolean
  bypassed: boolean
}

/**
 * Composable for managing the More Options menu configuration
 */
export function useMoreOptionsMenu() {
  // Initialize composables
  const canvasStore = useCanvasStore()
  const workflowStore = useWorkflowStore()
  const {
    copySelection,
    duplicateSelection,
    deleteSelection,
    renameSelection
  } = useSelectionOperations()

  const { shapeOptions, applyShape, isLightTheme } = useNodeCustomization()

  const { convertToSubgraph, unpackSubgraph, addSubgraphToLibrary } =
    useSubgraphOperations()

  const {
    adjustNodeSize,
    toggleNodeCollapse,
    toggleNodePin,
    toggleNodeBypass,
    runBranch
  } = useNodeInfo()

  // Info button functionality (same as InfoButton.vue)
  const nodeDefStore = useNodeDefStore()
  const sidebarTabStore = useSidebarTabStore()
  const nodeHelpStore = useNodeHelpStore()
  const { id: nodeLibraryTabId } = useNodeLibrarySidebarTab()

  const nodeDef = computed(() => {
    if (canvasStore.selectedItems.length !== 1) return null
    const item = canvasStore.selectedItems[0]
    if (!isLGraphNode(item)) return null
    return nodeDefStore.fromLGraphNode(item)
  })

  const showNodeHelp = () => {
    const def = nodeDef.value
    if (!def) return
    if (sidebarTabStore.activeSidebarTabId !== nodeLibraryTabId) {
      sidebarTabStore.toggleSidebarTab(nodeLibraryTabId)
    }
    nodeHelpStore.openHelp(def)
  }

  // Computed properties to check current state of selected items
  const selectedNodes = computed(() => {
    return canvasStore.selectedItems.filter((item) =>
      isLGraphNode(item)
    ) as LGraphNode[]
  })

  const hasSubgraphs = computed(() => {
    return canvasStore.selectedItems.some(
      (item) => item instanceof SubgraphNode
    )
  })

  const selectedNodesStates = computed((): NodeSelectionState => {
    const nodes = selectedNodes.value
    if (nodes.length === 0)
      return { collapsed: false, pinned: false, bypassed: false }

    const collapsed = nodes.some((node) => node.flags?.collapsed)
    const pinned = nodes.some((node) => node.pinned)
    const bypassed = nodes.some((node) => node.mode === LGraphEventMode.BYPASS)

    return { collapsed, pinned, bypassed }
  })

  // Helper to convert dark colors to light theme colors
  const toLightThemeColor = (color: string) =>
    adjustColor(color, { lightness: 0.5 })

  // Create shape submenu options (no icons)
  const shapeSubmenu = computed((): SubMenuOption[] =>
    shapeOptions.map((shape) => ({
      label: shape.localizedName,
      action: () => applyShape(shape)
    }))
  )

  // Create color submenu options (matching ColorPickerButton)
  const colorSubmenu = computed((): SubMenuOption[] => {
    // Start with "No Color" option
    const options: SubMenuOption[] = [
      {
        label: 'No Color',
        color: isLightTheme.value
          ? toLightThemeColor(LiteGraph.NODE_DEFAULT_BGCOLOR)
          : LiteGraph.NODE_DEFAULT_BGCOLOR,
        action: () => {
          // Apply no color (null) to reset to default
          for (const item of canvasStore.selectedItems) {
            if (
              'setColorOption' in item &&
              typeof item.setColorOption === 'function'
            ) {
              ;(item as any).setColorOption(null)
            }
          }
          canvasStore.canvas?.setDirty(true, true)
          workflowStore.activeWorkflow?.changeTracker?.checkState()
        }
      }
    ]

    // Add all available node colors from LGraphCanvas
    Object.entries(LGraphCanvas.node_colors).forEach(([name, colorOption]) => {
      options.push({
        label: name,
        color: isLightTheme.value
          ? toLightThemeColor(colorOption.bgcolor)
          : colorOption.bgcolor,
        action: () => {
          for (const item of canvasStore.selectedItems) {
            if (
              'setColorOption' in item &&
              typeof item.setColorOption === 'function'
            ) {
              ;(item as any).setColorOption(colorOption)
            }
          }
          canvasStore.canvas?.setDirty(true, true)
          workflowStore.activeWorkflow?.changeTracker?.checkState()
        }
      })
    })

    return options
  })

  const menuOptions = computed((): MenuOption[] => {
    const states = selectedNodesStates.value
    const hasSubgraphsSelected = hasSubgraphs.value

    const baseOptions: MenuOption[] = [
      {
        label: 'Rename',
        action: renameSelection
      },
      {
        type: 'divider'
      },
      {
        label: 'Copy',
        shortcut: 'Ctrl+C',
        action: copySelection
      },
      {
        label: 'Duplicate',
        shortcut: 'Ctrl+D',
        action: duplicateSelection
      },
      {
        type: 'divider'
      },
      {
        label: 'Node Info',
        icon: markRaw(ILucideInfo),
        action: showNodeHelp
      },
      {
        label: 'Adjust Size',
        icon: markRaw(ILucideMoveDiagonal2),
        action: adjustNodeSize
      },
      // Show appropriate collapse/expand option based on current state
      {
        label: states.collapsed ? 'Expand Node' : 'Minimize Node',
        icon: markRaw(states.collapsed ? ILucideMaximize2 : ILucideMinimize2),
        action: toggleNodeCollapse
      },
      {
        type: 'divider'
      },
      {
        label: 'Shape',
        icon: markRaw(ILucideBox),
        hasSubmenu: true,
        submenu: shapeSubmenu.value,
        action: () => {} // No-op for submenu items
      },
      {
        label: 'Color',
        icon: markRaw(ILucidePalette),
        hasSubmenu: true,
        submenu: colorSubmenu.value,
        action: () => {} // No-op for submenu items
      },
      {
        type: 'divider'
      },
      {
        label: 'Add Subgraph to Library',
        icon: markRaw(ILucideFolderPlus),
        action: addSubgraphToLibrary
      }
    ]

    // Add appropriate subgraph option based on selection
    if (hasSubgraphsSelected) {
      baseOptions.push({
        label: 'Unpack Subgraph',
        icon: markRaw(ILucideExpand),
        action: unpackSubgraph
      })
    } else {
      baseOptions.push({
        label: 'Convert to Subgraph',
        icon: markRaw(ILucideShrink),
        action: convertToSubgraph
      })
    }

    // Add remaining options
    baseOptions.push(
      {
        type: 'divider'
      },
      // Show appropriate pin option based on current state
      {
        label: states.pinned ? 'Unpin' : 'Pin',
        icon: markRaw(states.pinned ? ILucidePinOff : ILucidePin),
        action: toggleNodePin
      },
      {
        type: 'divider'
      },
      // Show appropriate bypass option based on current state
      {
        label: states.bypassed ? 'Remove Bypass' : 'Bypass',
        icon: markRaw(states.bypassed ? ILucideZapOff : ILucideBan),
        shortcut: 'Ctrl+B',
        action: toggleNodeBypass
      },
      {
        label: 'Run Branch',
        icon: markRaw(ILucidePlay),
        action: runBranch
      },
      {
        type: 'divider'
      },
      {
        label: 'Delete',
        icon: markRaw(ILucideTrash2),
        shortcut: 'Delete',
        action: deleteSelection
      }
    )

    return baseOptions
  })

  // Computed property to get only menu items with submenus
  const menuOptionsWithSubmenu = computed(() =>
    menuOptions.value.filter((option) => option.hasSubmenu && option.submenu)
  )

  return {
    menuOptions,
    menuOptionsWithSubmenu,
    selectedNodesStates,
    hasSubgraphs
  }
}
