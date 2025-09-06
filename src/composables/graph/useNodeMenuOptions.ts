import {
  Ban,
  Box,
  Info,
  Maximize2,
  Minimize2,
  MoveDiagonal2,
  Palette,
  Pin,
  PinOff,
  Play,
  ZapOff
} from 'lucide-vue-next'
import { computed, markRaw } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MenuOption, NodeSelectionState } from './useMoreOptionsMenu'
import { useNodeCustomization } from './useNodeCustomization'
import { useNodeInfo } from './useNodeInfo'

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
  } = useNodeInfo()

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
    icon: markRaw(MoveDiagonal2),
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
    }
  ]

  const getPinOption = (
    states: NodeSelectionState,
    bump: () => void
  ): MenuOption => ({
    label: states.pinned ? t('contextMenu.Unpin') : t('contextMenu.Pin'),
    icon: markRaw(states.pinned ? PinOff : Pin),
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
    icon: markRaw(states.bypassed ? ZapOff : Ban),
    shortcut: 'Ctrl+B',
    action: () => {
      toggleNodeBypass()
      bump()
    }
  })

  const getRunBranchOption = (): MenuOption => ({
    label: t('contextMenu.Run Branch'),
    icon: markRaw(Play),
    action: runBranch
  })

  // Keep this for backward compatibility if needed
  const getBasicNodeOptions = (
    states: NodeSelectionState,
    hasOutputNodes: boolean,
    bump: () => void
  ): MenuOption[] => {
    const options: MenuOption[] = []
    options.push(getAdjustSizeOption())
    options.push(...getNodeVisualOptions(states, bump))
    options.push(getPinOption(states, bump))
    options.push(getBypassOption(states, bump))
    if (hasOutputNodes) {
      options.push(getRunBranchOption())
    }
    return options
  }

  const getNodeInfoOption = (showNodeHelp: () => void): MenuOption => ({
    label: t('contextMenu.Node Info'),
    icon: markRaw(Info),
    action: showNodeHelp
  })

  return {
    getBasicNodeOptions,
    getNodeInfoOption,
    getAdjustSizeOption,
    getNodeVisualOptions,
    getPinOption,
    getBypassOption,
    getRunBranchOption,
    shapeSubmenu,
    colorSubmenu
  }
}
