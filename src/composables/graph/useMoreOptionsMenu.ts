import { type Component, computed, markRaw } from 'vue'
import { useI18n } from 'vue-i18n'
// Import icons
import ILucideAlignCenterHorizontal from '~icons/lucide/align-center-horizontal'
import ILucideAlignStartHorizontal from '~icons/lucide/align-start-horizontal'
import ILucideBan from '~icons/lucide/ban'
import ILucideBox from '~icons/lucide/box'
import ILucideClipboard from '~icons/lucide/clipboard'
import ILucideCopy from '~icons/lucide/copy'
import ILucideDownload from '~icons/lucide/download'
import ILucideExpand from '~icons/lucide/expand'
import ILucideExternalLink from '~icons/lucide/external-link'
import ILucideFolderPlus from '~icons/lucide/folder-plus'
import ILucideGroup from '~icons/lucide/group'
import ILucideInfo from '~icons/lucide/info'
import ILucideMaximize2 from '~icons/lucide/maximize-2'
import ILucideMinimize2 from '~icons/lucide/minimize-2'
import ILucideMoveDiagonal2 from '~icons/lucide/move-diagonal-2'
import ILucidePalette from '~icons/lucide/palette'
import ILucidePanelTop from '~icons/lucide/panel-top'
import ILucidePin from '~icons/lucide/pin'
import ILucidePinOff from '~icons/lucide/pin-off'
import ILucidePlay from '~icons/lucide/play'
import ILucideShrink from '~icons/lucide/shrink'
import ILucideTrash2 from '~icons/lucide/trash-2'
import ILucideZapOff from '~icons/lucide/zap-off'

import { useNodeArrangement } from '@/composables/graph/useNodeArrangement'
import { useNodeCustomization } from '@/composables/graph/useNodeCustomization'
import { useNodeInfo } from '@/composables/graph/useNodeInfo'
import { useSelectionOperations } from '@/composables/graph/useSelectionOperations'
import { useSubgraphOperations } from '@/composables/graph/useSubgraphOperations'
import { useNodeLibrarySidebarTab } from '@/composables/sidebarTabs/useNodeLibrarySidebarTab'
import {
  LGraphEventMode,
  LGraphNode,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
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
  const { t } = useI18n()
  const canvasStore = useCanvasStore()
  const {
    copySelection,
    duplicateSelection,
    deleteSelection,
    renameSelection,
    pasteSelection
  } = useSelectionOperations()

  const { shapeOptions, applyShape, applyColor, colorOptions, isLightTheme } =
    useNodeCustomization()

  const { alignOptions, distributeOptions, applyAlign, applyDistribute } =
    useNodeArrangement()

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

  // Check if we have an image node selected
  const hasImageNode = computed(() => {
    if (selectedNodes.value.length !== 1) return false
    const node = selectedNodes.value[0]
    return node.imgs && node.imgs.length > 0
  })

  // Check if we have multiple nodes selected
  const hasMultipleNodes = computed(() => {
    return selectedNodes.value.length > 1
  })

  // Check if we have a single node selected
  const hasSingleNode = computed(() => {
    return selectedNodes.value.length === 1
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

  // Image node operations
  const openMaskEditor = () => {
    const commandStore = useCommandStore()
    void commandStore.execute('Comfy.MaskEditor.OpenMaskEditor')
  }

  const openImage = () => {
    const node = selectedNodes.value[0]
    if (!node?.imgs?.length) return
    const img = node.imgs[node.imageIndex ?? 0]
    if (!img) return
    const url = new URL(img.src)
    url.searchParams.delete('preview')
    window.open(url.toString(), '_blank')
  }

  const copyImage = async () => {
    const node = selectedNodes.value[0]
    if (!node?.imgs?.length) return
    const img = node.imgs[node.imageIndex ?? 0]
    if (!img) return

    // Use canvas to copy image to clipboard
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    ctx.drawImage(img, 0, 0)

    canvas.toBlob(async (blob) => {
      if (!blob) return
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ])
      } catch {
        // Silently fail - clipboard operations may not be supported
      }
    }, 'image/png')
  }

  const saveImage = () => {
    const node = selectedNodes.value[0]
    if (!node?.imgs?.length) return
    const img = node.imgs[node.imageIndex ?? 0]
    if (!img) return

    try {
      const url = new URL(img.src)
      url.searchParams.delete('preview')

      const a = document.createElement('a')
      a.href = url.toString()
      a.setAttribute(
        'download',
        new URLSearchParams(url.search).get('filename') ?? 'image.png'
      )
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()

      // Clean up immediately
      requestAnimationFrame(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a)
        }
      })
    } catch {
      // Silently fail - URL construction or download may not be supported
    }
  }

  // Properties panel
  const showPropertiesPanel = () => {
    const node = selectedNodes.value[0]
    if (!node) return
    canvasStore.canvas?.showShowNodePanel(node)
  }

  // Convert to group nodes
  const convertToGroupNodes = () => {
    const commandStore = useCommandStore()
    void commandStore.execute('Comfy.GroupNode.ConvertSelectedNodesToGroupNode')
  }

  // Create align submenu options
  const alignSubmenu = computed((): SubMenuOption[] =>
    alignOptions.map((align) => ({
      label: align.localizedName,
      icon: align.icon,
      action: () => applyAlign(align)
    }))
  )

  // Create distribute submenu options
  const distributeSubmenu = computed((): SubMenuOption[] =>
    distributeOptions.map((distribute) => ({
      label: distribute.localizedName,
      icon: distribute.icon,
      action: () => applyDistribute(distribute)
    }))
  )

  // Create shape submenu options (no icons)
  const shapeSubmenu = computed((): SubMenuOption[] =>
    shapeOptions.map((shape) => ({
      label: shape.localizedName,
      action: () => applyShape(shape)
    }))
  )

  // Create color submenu options using colorOptions from useNodeCustomization
  const colorSubmenu = computed((): SubMenuOption[] => {
    return colorOptions.map((colorOption) => ({
      label: colorOption.localizedName,
      color: isLightTheme.value
        ? colorOption.value.light
        : colorOption.value.dark,
      action: () =>
        applyColor(colorOption.name === 'noColor' ? null : colorOption)
    }))
  })

  const menuOptions = computed((): MenuOption[] => {
    const states = selectedNodesStates.value
    const hasSubgraphsSelected = hasSubgraphs.value
    const options: MenuOption[] = []

    // Image node specific options (only for single image node)
    if (hasImageNode.value) {
      options.push(
        {
          label: t('contextMenu.Open in Mask Editor'),
          action: openMaskEditor
        },
        {
          label: t('contextMenu.Open Image'),
          icon: markRaw(ILucideExternalLink),
          action: openImage
        },
        {
          label: t('contextMenu.Copy Image'),
          icon: markRaw(ILucideCopy),
          action: copyImage
        },
        {
          label: t('contextMenu.Save Image'),
          icon: markRaw(ILucideDownload),
          action: saveImage
        },
        {
          type: 'divider'
        }
      )
    }

    // Common options for all selections
    options.push(
      {
        label: t('contextMenu.Rename'),
        action: renameSelection
      },
      {
        type: 'divider'
      },
      {
        label: t('contextMenu.Copy'),
        shortcut: 'Ctrl+C',
        action: copySelection
      },
      {
        label: t('contextMenu.Duplicate'),
        shortcut: 'Ctrl+D',
        action: duplicateSelection
      }
    )

    // Add paste option if not already added (for single nodes)
    if (!hasMultipleNodes.value) {
      options.push({
        label: t('contextMenu.Paste'),
        icon: markRaw(ILucideClipboard),
        shortcut: 'Ctrl+V',
        action: pasteSelection
      })
    }

    options.push(
      {
        type: 'divider'
      },
      {
        label: t('contextMenu.Node Info'),
        icon: markRaw(ILucideInfo),
        action: showNodeHelp
      },
      {
        label: t('contextMenu.Adjust Size'),
        icon: markRaw(ILucideMoveDiagonal2),
        action: adjustNodeSize
      }
    )

    // Properties panel for single nodes (moved to middle of menu)
    if (hasSingleNode.value) {
      options.push({
        label: t('contextMenu.Properties Panel'),
        icon: markRaw(ILucidePanelTop),
        action: showPropertiesPanel
      })
    }

    options.push(
      // Show appropriate collapse/expand option based on current state
      {
        label: states.collapsed
          ? t('contextMenu.Expand Node')
          : t('contextMenu.Minimize Node'),
        icon: markRaw(states.collapsed ? ILucideMaximize2 : ILucideMinimize2),
        action: toggleNodeCollapse
      },
      {
        type: 'divider'
      },
      {
        label: t('contextMenu.Shape'),
        icon: markRaw(ILucideBox),
        hasSubmenu: true,
        submenu: shapeSubmenu.value,
        action: () => {} // No-op for submenu items
      },
      {
        label: t('contextMenu.Color'),
        icon: markRaw(ILucidePalette),
        hasSubmenu: true,
        submenu: colorSubmenu.value,
        action: () => {} // No-op for submenu items
      },
      {
        type: 'divider'
      },
      {
        label: t('contextMenu.Add Subgraph to Library'),
        icon: markRaw(ILucideFolderPlus),
        action: addSubgraphToLibrary
      }
    )

    // Add appropriate subgraph option based on selection
    if (hasSubgraphsSelected) {
      options.push({
        label: t('contextMenu.Unpack Subgraph'),
        icon: markRaw(ILucideExpand),
        action: unpackSubgraph
      })
    } else {
      options.push({
        label: t('contextMenu.Convert to Subgraph'),
        icon: markRaw(ILucideShrink),
        action: convertToSubgraph
      })
    }

    // Add remaining options
    options.push(
      {
        type: 'divider'
      },
      // Show appropriate pin option based on current state
      {
        label: states.pinned ? t('contextMenu.Unpin') : t('contextMenu.Pin'),
        icon: markRaw(states.pinned ? ILucidePinOff : ILucidePin),
        action: toggleNodePin
      },
      {
        type: 'divider'
      }
    )

    // Add alignment and distribution options for multiple nodes
    if (hasMultipleNodes.value) {
      options.push(
        {
          label: t('contextMenu.Align Selected To'),
          icon: markRaw(ILucideAlignStartHorizontal),
          hasSubmenu: true,
          submenu: alignSubmenu.value,
          action: () => {} // No-op for submenu items
        },
        {
          label: t('contextMenu.Distribute Nodes'),
          icon: markRaw(ILucideAlignCenterHorizontal),
          hasSubmenu: true,
          submenu: distributeSubmenu.value,
          action: () => {} // No-op for submenu items
        },
        {
          type: 'divider'
        }
      )
    }

    options.push(
      // Show appropriate bypass option based on current state
      {
        label: states.bypassed
          ? t('contextMenu.Remove Bypass')
          : t('contextMenu.Bypass'),
        icon: markRaw(states.bypassed ? ILucideZapOff : ILucideBan),
        shortcut: 'Ctrl+B',
        action: toggleNodeBypass
      },
      {
        label: t('contextMenu.Run Branch'),
        icon: markRaw(ILucidePlay),
        action: runBranch
      },
      {
        type: 'divider'
      }
    )

    // Add paste and convert to group for multiple nodes
    if (hasMultipleNodes.value) {
      options.push(
        {
          label: t('contextMenu.Paste'),
          icon: markRaw(ILucideClipboard),
          shortcut: 'Ctrl+V',
          action: pasteSelection
        },
        {
          label: t('contextMenu.Convert to Group Nodes'),
          icon: markRaw(ILucideGroup),
          action: convertToGroupNodes
        },
        {
          type: 'divider'
        }
      )
    }

    options.push({
      label: t('contextMenu.Delete'),
      icon: markRaw(ILucideTrash2),
      shortcut: 'Delete',
      action: deleteSelection
    })

    return options
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
