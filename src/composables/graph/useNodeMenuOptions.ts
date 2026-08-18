import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'

import type { MenuOption } from './useMoreOptionsMenu'
import { useNodeCustomization } from './useNodeCustomization'
import { useSelectedNodeActions } from './useSelectedNodeActions'
import type { NodeSelectionState } from './useSelectionState'

/**
 * Composable for node-related menu operations
 */
export function useNodeMenuOptions() {
  const { t } = useI18n()
  const { shapeOptions, applyShape, applyColor, colorOptions, isLightTheme } =
    useNodeCustomization()
  const {
    adjustNodeSize,
    toggleNodeCollapse,
    toggleNodePin,
    toggleNodeBypass,
    runBranch
  } = useSelectedNodeActions()
  const { areAllSelectedNodesInMode } = useSelectedLiteGraphItems()

  const shapeSubmenu = computed(() =>
    shapeOptions.map((shape) => ({
      label: shape.localizedName,
      action: () => applyShape(shape)
    }))
  )

  const colorSubmenu = computed(() => {
    return colorOptions.map((colorOption) => ({
      label: colorOption.localizedName,
      color: isLightTheme.value
        ? colorOption.value.light
        : colorOption.value.dark,
      action: () =>
        applyColor(colorOption.name === 'noColor' ? null : colorOption)
    }))
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
      isShapePicker: true,
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

  const getBypassOption = (bump: () => void): MenuOption => ({
    label: areAllSelectedNodesInMode(LGraphEventMode.BYPASS)
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

  const getNodeInfoOption = (openNodeInfo: () => boolean): MenuOption => ({
    label: t('contextMenu.Node Info'),
    icon: 'icon-[lucide--info]',
    action: openNodeInfo
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
