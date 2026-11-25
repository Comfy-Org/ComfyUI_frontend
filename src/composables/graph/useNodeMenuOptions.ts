import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'

import { useThemeStore } from '@/platform/theme/themeStore'

import type { MenuOption } from './menuOption'
import { useNodeCustomization } from './useNodeCustomization'
import { useSelectedNodeActions } from './useSelectedNodeActions'
import type { NodeSelectionState } from './useSelectionState'

export function useNodeMenuOptions() {
  const { t } = useI18n()
  const themeStore = useThemeStore()
  const { shapeOptions, applyShape, applyColor, colorOptions } =
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
      color: themeStore.toNodeColor(colorOption.value),
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
      id: 'collapse',
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
      id: 'shape',
      label: t('contextMenu.Shape'),
      icon: 'icon-[lucide--box]',
      hasSubmenu: true,
      submenu: shapeSubmenu.value,
      isShapePicker: true,
      action: () => {}
    },
    {
      id: 'color',
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
    id: 'pin',
    label: states.pinned ? t('contextMenu.Unpin') : t('contextMenu.Pin'),
    icon: states.pinned ? 'icon-[lucide--pin-off]' : 'icon-[lucide--pin]',
    action: () => {
      toggleNodePin()
      bump()
    }
  })

  const getBypassOption = (bump: () => void): MenuOption => ({
    id: 'bypass',
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
    id: 'runBranch',
    label: t('contextMenu.Run Branch'),
    icon: 'icon-[lucide--play]',
    action: runBranch
  })

  const getNodeInfoOption = (openNodeInfo: () => boolean): MenuOption => ({
    id: 'nodeInfo',
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
