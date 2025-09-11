import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MenuOption } from './useMoreOptionsMenu'
import { useNodeCustomization } from './useNodeCustomization'
import { useNodeInfo } from './useNodeInfo'
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
    icon: states.bypassed ? 'icon-[lucide--zap-off]' : 'icon-[lucide--ban]',
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
    icon: 'icon-[lucide--info]',
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
