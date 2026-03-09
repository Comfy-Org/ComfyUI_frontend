import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { getDefaultCustomNodeColor } from '@/utils/nodeColorCustomization'

import type { MenuOption } from './useMoreOptionsMenu'
import { useNodeCustomization } from './useNodeCustomization'
import { useSelectedNodeActions } from './useSelectedNodeActions'
import type { NodeSelectionState } from './useSelectionState'

/**
 * Composable for node-related menu operations
 */
export function useNodeMenuOptions() {
  const { t } = useI18n()
  const {
    shapeOptions,
    applyShape,
    applyColor,
    applyCustomColor,
    colorOptions,
    favoriteColors,
    recentColors,
    getCurrentAppliedColor,
    isLightTheme
  } = useNodeCustomization()
  const {
    adjustNodeSize,
    toggleNodeCollapse,
    toggleNodePin,
    toggleNodeBypass,
    runBranch
  } = useSelectedNodeActions()

  const shapeSubmenu = computed(() =>
    shapeOptions.map((shape) => ({
      label: shape.localizedName,
      action: () => applyShape(shape)
    }))
  )

  const colorSubmenu = computed(() => {
    const currentAppliedColor = getCurrentAppliedColor()
    const presetEntries = colorOptions.map((colorOption) => ({
      label: colorOption.localizedName,
      color: isLightTheme.value
        ? colorOption.value.light
        : colorOption.value.dark,
      action: () =>
        applyColor(colorOption.name === 'noColor' ? null : colorOption)
    }))

    const presetColors = new Set(
      colorOptions.map((colorOption) => colorOption.value.dark.toLowerCase())
    )
    const customEntries = [
      ...favoriteColors.value.map((color) => ({
        label: `${t('g.favorites')}: ${color.toUpperCase()}`,
        color
      })),
      ...recentColors.value.map((color) => ({
        label: `${t('modelLibrary.sortRecent')}: ${color.toUpperCase()}`,
        color
      }))
    ]
      .filter((entry, index, entries) => {
        return (
          entries.findIndex((candidate) => candidate.color === entry.color) ===
          index
        )
      })
      .filter((entry) => !presetColors.has(entry.color.toLowerCase()))
      .map((entry) => ({
        ...entry,
        action: () => {
          void applyCustomColor(entry.color)
        }
      }))

    return [
      ...presetEntries,
      ...customEntries,
      {
        label: t('g.custom'),
        color: currentAppliedColor ?? undefined,
        pickerValue: (currentAppliedColor ?? getDefaultCustomNodeColor()).replace(
          '#',
          ''
        ),
        onColorPick: applyCustomColor,
        action: () => {}
      }
    ]
  })

  const getAdjustSizeOption = (): MenuOption => ({
    label: t('contextMenu.Adjust Size'),
    icon: 'icon-[lucide--move-diagonal-2]',
    action: adjustNodeSize
  })

  const getNodeVisualOptions = (
    states: NodeSelectionState,
    bump: () => void
  ): MenuOption[] => [
    {
      label: states.collapsed
        ? t('contextMenu.Expand Node')
        : t('contextMenu.Minimize Node'),
      icon: states.collapsed
        ? 'icon-[lucide--maximize-2]'
        : 'icon-[lucide--minimize-2]',
      action: () => {
        toggleNodeCollapse()
        bump()
      }
    },
    {
      label: t('contextMenu.Shape'),
      icon: 'icon-[lucide--box]',
      hasSubmenu: true,
      submenu: shapeSubmenu.value,
      action: () => {}
    },
    {
      label: t('contextMenu.Color'),
      icon: 'icon-[lucide--palette]',
      hasSubmenu: true,
      submenu: colorSubmenu.value,
      isColorPicker: true,
      action: () => {}
    }
  ]

  const getPinOption = (
    states: NodeSelectionState,
    bump: () => void
  ): MenuOption => ({
    label: states.pinned ? t('contextMenu.Unpin') : t('contextMenu.Pin'),
    icon: states.pinned ? 'icon-[lucide--pin-off]' : 'icon-[lucide--pin]',
    action: () => {
      toggleNodePin()
      bump()
    }
  })

  const getBypassOption = (
    states: NodeSelectionState,
    bump: () => void
  ): MenuOption => ({
    label: states.bypassed
      ? t('contextMenu.Remove Bypass')
      : t('contextMenu.Bypass'),
    icon: 'icon-[lucide--redo-dot]',
    shortcut: 'Ctrl+B',
    action: () => {
      toggleNodeBypass()
      bump()
    }
  })

  const getRunBranchOption = (): MenuOption => ({
    label: t('contextMenu.Run Branch'),
    icon: 'icon-[lucide--play]',
    action: runBranch
  })

  const getNodeInfoOption = (showNodeHelp: () => void): MenuOption => ({
    label: t('contextMenu.Node Info'),
    icon: 'icon-[lucide--info]',
    action: showNodeHelp
  })

  return {
    getNodeInfoOption,
    getAdjustSizeOption,
    getNodeVisualOptions,
    getPinOption,
    getBypassOption,
    getRunBranchOption,
    colorSubmenu
  }
}
