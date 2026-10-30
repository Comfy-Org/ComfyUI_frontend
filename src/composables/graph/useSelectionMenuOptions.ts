import { useI18n } from 'vue-i18n'

import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { useFrameNodes } from './useFrameNodes'
import { BadgeVariant } from './menuOption'
import type { MenuOption } from './menuOption'
import { ARRANGE_ICON, useNodeArrangement } from './useNodeArrangement'
import { useSelectionOperations } from './useSelectionOperations'
import { useSubgraphOperations } from './useSubgraphOperations'

/**
 * Composable for selection-related menu operations
 */
export function useSelectionMenuOptions() {
  const { t } = useI18n()
  const {
    copySelection,
    duplicateSelection,
    deleteSelection,
    renameSelection
  } = useSelectionOperations()

  const {
    canArrange,
    alignOptions,
    distributeOptions,
    applyAlign,
    applyDistribute
  } = useNodeArrangement()

  const { convertToSubgraph, unpackSubgraph, addSubgraphToLibrary } =
    useSubgraphOperations()

  const { frameNodes } = useFrameNodes()

  const { canTidy, tidyUp } = useSelectionGrid()

  const getBasicSelectionOptions = (): MenuOption[] => [
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
  ]

  const getSubgraphOptions = ({
    hasSubgraphs,
    hasMultipleSelection
  }: {
    hasSubgraphs: boolean
    hasMultipleSelection: boolean
  }): MenuOption[] => {
    const convertOption: MenuOption = {
      label: t('contextMenu.Convert to Subgraph'),
      icon: 'icon-[lucide--shrink]',
      action: convertToSubgraph,
      badge: BadgeVariant.NEW
    }

    const options: MenuOption[] = []
    const showConvertOption = !hasSubgraphs || hasMultipleSelection

    if (showConvertOption) {
      options.push(convertOption)
    }

    if (hasSubgraphs) {
      if (!hasMultipleSelection) {
        options.push({
          label: t('contextMenu.Add Subgraph to Library'),
          icon: 'icon-[lucide--folder-plus]',
          action: addSubgraphToLibrary
        })
      }
      options.push({
        label: t('contextMenu.Unpack Subgraph'),
        icon: 'icon-[lucide--expand]',
        action: unpackSubgraph
      })
    }

    return options
  }

  const getMultipleNodesOptions = (): MenuOption[] => [
    {
      label: t('g.frameNodes'),
      icon: 'icon-[lucide--frame]',
      action: frameNodes
    }
  ]

  const getArrangeOption = (alignTo?: LGraphNode): MenuOption => ({
    label: t('contextMenu.Arrange'),
    icon: ARRANGE_ICON,
    hasSubmenu: true,
    submenu: [
      {
        label: t('g.tidyUp'),
        icon: 'icon-[lucide--layout-dashboard]',
        disabled: !canTidy.value,
        action: () => tidyUp()
      },
      { type: 'divider' },
      ...alignOptions.map((align) => ({
        label: align.localizedName,
        icon: align.icon,
        disabled: !canArrange.value,
        action: () => applyAlign(align, alignTo)
      })),
      { type: 'divider' },
      ...distributeOptions.map((distribute) => ({
        label: distribute.localizedName,
        icon: distribute.icon,
        disabled: !canArrange.value,
        action: () => applyDistribute(distribute)
      }))
    ],
    action: () => {}
  })

  const getDeleteOption = (disabled: boolean): MenuOption => ({
    label: t('contextMenu.Delete'),
    icon: 'icon-[lucide--trash-2]',
    shortcut: 'Delete',
    disabled,
    action: deleteSelection
  })

  return {
    getBasicSelectionOptions,
    getSubgraphOptions,
    getMultipleNodesOptions,
    getDeleteOption,
    getArrangeOption
  }
}
