import {
  AlignCenterHorizontal,
  AlignStartHorizontal,
  Ban,
  Box,
  Copy,
  Download,
  Expand,
  ExternalLink,
  FolderPlus,
  Frame,
  Group,
  Info,
  Maximize2,
  Minimize2,
  MoveDiagonal2,
  Palette,
  Pin,
  PinOff,
  Play,
  Shrink,
  Trash2,
  ZapOff
} from 'lucide-vue-next'
import { type Component, computed, markRaw, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFrameNodes } from '@/composables/graph/useFrameNodes'
import { useNodeArrangement } from '@/composables/graph/useNodeArrangement'
import { useNodeCustomization } from '@/composables/graph/useNodeCustomization'
import { useNodeInfo } from '@/composables/graph/useNodeInfo'
import { useSelectionOperations } from '@/composables/graph/useSelectionOperations'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useSubgraphOperations } from '@/composables/graph/useSubgraphOperations'
import { useCommandStore } from '@/stores/commandStore'

export interface MenuOption {
  label?: string
  icon?: Component
  shortcut?: string
  hasSubmenu?: boolean
  type?: 'divider'
  action?: () => void
  submenu?: SubMenuOption[]
  badge?: BadgeVariant
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
export enum BadgeVariant {
  NEW = 'new',
  DEPRECATED = 'deprecated'
}

/**
 * Composable for managing the More Options menu configuration
 */
export function useMoreOptionsMenu() {
  const { t } = useI18n()
  const {
    copySelection,
    duplicateSelection,
    deleteSelection,
    renameSelection
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

  const {
    selectedNodes,
    nodeDef,
    showNodeHelp,
    hasSubgraphs: hasSubgraphsComputed,
    hasImageNode,
    hasOutputNodesSelected,
    hasMultipleSelection,
    computeSelectionFlags
  } = useSelectionState()

  const hasSubgraphs = hasSubgraphsComputed
  const hasMultipleNodes = hasMultipleSelection

  // Internal version to force menu rebuild after state mutations
  const optionsVersion = ref(0)
  const bump = () => {
    optionsVersion.value++
  }

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
      } catch (error) {
        console.error('Failed to copy image:', error)
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

      requestAnimationFrame(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a)
        }
      })
    } catch (error) {
      console.error('Failed to save image:', error)
    }
  }

  const convertToGroupNodes = () => {
    const commandStore = useCommandStore()
    void commandStore.execute('Comfy.GroupNode.ConvertSelectedNodesToGroupNode')
  }
  const { frameNodes } = useFrameNodes()

  const alignSubmenu = computed((): SubMenuOption[] =>
    alignOptions.map((align) => ({
      label: align.localizedName,
      icon: align.icon,
      action: () => applyAlign(align)
    }))
  )

  const distributeSubmenu = computed((): SubMenuOption[] =>
    distributeOptions.map((distribute) => ({
      label: distribute.localizedName,
      icon: distribute.icon,
      action: () => applyDistribute(distribute)
    }))
  )

  const shapeSubmenu = computed((): SubMenuOption[] =>
    shapeOptions.map((shape) => ({
      label: shape.localizedName,
      action: () => applyShape(shape)
    }))
  )

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
    // Reference selection flags to ensure re-computation when they change
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    optionsVersion.value
    const states = computeSelectionFlags()
    const hasSubgraphsSelected = hasSubgraphs.value
    const options: MenuOption[] = []

    options.push(
      {
        label: t('contextMenu.Rename'),
        action: renameSelection
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

    options.push({ type: 'divider' })

    if (nodeDef.value) {
      options.push({
        label: t('contextMenu.Node Info'),
        icon: markRaw(Info),
        action: showNodeHelp
      })
    }

    options.push({
      label: t('contextMenu.Adjust Size'),
      icon: markRaw(MoveDiagonal2),
      action: adjustNodeSize
    })

    options.push(
      {
        label: states.collapsed
          ? t('contextMenu.Expand Node')
          : t('contextMenu.Minimize Node'),
        icon: markRaw(states.collapsed ? Maximize2 : Minimize2),
        action: () => {
          toggleNodeCollapse()
          bump()
        }
      },
      {
        label: t('contextMenu.Shape'),
        icon: markRaw(Box),
        hasSubmenu: true,
        submenu: shapeSubmenu.value,
        action: () => {}
      },
      {
        label: t('contextMenu.Color'),
        icon: markRaw(Palette),
        hasSubmenu: true,
        submenu: colorSubmenu.value,
        action: () => {}
      },
      {
        type: 'divider'
      }
    )

    if (hasImageNode.value) {
      options.push(
        {
          label: t('contextMenu.Open in Mask Editor'),
          action: openMaskEditor
        },
        {
          label: t('contextMenu.Open Image'),
          icon: markRaw(ExternalLink),
          action: openImage
        },
        {
          label: t('contextMenu.Copy Image'),
          icon: markRaw(Copy),
          action: copyImage
        },
        {
          label: t('contextMenu.Save Image'),
          icon: markRaw(Download),
          action: saveImage
        }
      )
    }

    // Add appropriate subgraph option based on selection
    if (hasSubgraphsSelected) {
      options.push({
        label: t('contextMenu.Add Subgraph to Library'),
        icon: markRaw(FolderPlus),
        action: addSubgraphToLibrary
      })
      options.push({
        label: t('contextMenu.Unpack Subgraph'),
        icon: markRaw(Expand),
        action: unpackSubgraph
      })
    } else {
      options.push({
        label: t('contextMenu.Convert to Subgraph'),
        icon: markRaw(Shrink),
        action: convertToSubgraph,
        badge: BadgeVariant.NEW
      })
    }

    if (hasMultipleNodes.value) {
      options.push(
        {
          label: t('contextMenu.Convert to Group Node'),
          icon: markRaw(Group),
          action: convertToGroupNodes,
          badge: BadgeVariant.DEPRECATED
        },
        {
          label: t('g.frameNodes'),
          icon: markRaw(Frame),
          action: frameNodes
        }
      )
    }

    options.push({ type: 'divider' })

    // Add remaining options
    options.push({
      label: states.pinned ? t('contextMenu.Unpin') : t('contextMenu.Pin'),
      icon: markRaw(states.pinned ? PinOff : Pin),
      action: () => {
        toggleNodePin()
        bump()
      }
    })

    // Add alignment and distribution options for multiple nodes
    if (hasMultipleNodes.value) {
      options.push(
        {
          label: t('contextMenu.Align Selected To'),
          icon: markRaw(AlignStartHorizontal),
          hasSubmenu: true,
          submenu: alignSubmenu.value,
          action: () => {}
        },
        {
          label: t('contextMenu.Distribute Nodes'),
          icon: markRaw(AlignCenterHorizontal),
          hasSubmenu: true,
          submenu: distributeSubmenu.value,
          action: () => {}
        }
      )
    }

    options.push({
      label: states.bypassed
        ? t('contextMenu.Remove Bypass')
        : t('contextMenu.Bypass'),
      icon: markRaw(states.bypassed ? ZapOff : Ban),
      shortcut: 'Ctrl+B',
      action: () => {
        toggleNodeBypass()
        bump()
      }
    })

    if (hasOutputNodesSelected.value) {
      options.push({
        label: t('contextMenu.Run Branch'),
        icon: markRaw(Play),
        action: runBranch
      })
    }

    options.push({ type: 'divider' })

    options.push({
      label: t('contextMenu.Delete'),
      icon: markRaw(Trash2),
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
    bump,
    hasSubgraphs
  }
}
