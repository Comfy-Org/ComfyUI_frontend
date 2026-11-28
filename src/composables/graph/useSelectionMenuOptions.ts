import { useI18n } from 'vue-i18n'

import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { useFrameNodes } from './useFrameNodes'
import { BadgeVariant } from './menuOption'
import type { MenuOption } from './menuOption'
import { useNodeArrangement } from './useNodeArrangement'
import { useSelectionOperations } from './useSelectionOperations'
import { useSubgraphOperations } from './useSubgraphOperations'

export function useSelectionMenuOptions() {
  const { t } = useI18n()
  const {
    copySelection,
    duplicateSelection,
    deleteSelection,
    renameSelection
  } = useSelectionOperations()

  const {
    alignOptions,
    distributeOptions,
    applyAlign,
    applyDistribute,
    canDistribute
  } = useNodeArrangement()

  const { convertToSubgraph, unpackSubgraph, addSubgraphToLibrary } =
    useSubgraphOperations()

  const { frameNodes } = useFrameNodes()

  const { canTidy, tidyUp } = useSelectionGrid()

  const getBasicSelectionOptions = (): MenuOption[] => [
    {
      id: 'rename',
      label: t('contextMenu.Rename'),
      action: renameSelection
    },
    {
      id: 'copy',
      label: t('contextMenu.Copy'),
      shortcut: 'Ctrl+C',
      action: copySelection
    },
    {
      id: 'duplicate',
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
      id: 'convertSubgraph',
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
          id: 'addSubgraphToLibrary',
          label: t('contextMenu.Add Subgraph to Library'),
          icon: 'icon-[lucide--folder-plus]',
          action: addSubgraphToLibrary
        })
      }
      options.push({
        id: 'unpackSubgraph',
        label: t('contextMenu.Unpack Subgraph'),
        icon: 'icon-[lucide--expand]',
        action: unpackSubgraph
      })
    }

    return options
  }

  const getMultipleNodesOptions = (): MenuOption[] => [
    {
      id: 'frameNodes',
      label: t('g.frameNodes'),
      icon: 'icon-[lucide--frame]',
      action: frameNodes
    }
  ]

  const getAlignmentOptions = (alignTo?: LGraphNode): MenuOption[] => [
    {
      id: 'align',
      label: t('contextMenu.Align Selected To'),
      icon: 'icon-[lucide--align-start-horizontal]',
      hasSubmenu: true,
      submenu: alignOptions.map((align) => ({
        label: align.localizedName,
        icon: align.icon,
        action: () => applyAlign(align, alignTo)
      })),
      action: () => {}
    },
    {
      id: 'distribute',
      label: t('contextMenu.Distribute Nodes'),
      icon: 'icon-[lucide--align-center-horizontal]',
      disabled: !canDistribute.value,
      hasSubmenu: true,
      submenu: distributeOptions.map((distribute) => ({
        label: distribute.localizedName,
        icon: distribute.icon,
        action: () => applyDistribute(distribute)
      })),
      action: () => {}
    },
    {
      id: 'tidyUp',
      label: t('g.tidyUp'),
      icon: 'icon-[lucide--layout-dashboard]',
      disabled: !canTidy.value,
      action: () => tidyUp()
    }
  ]

  const getDeleteOption = (disabled: boolean): MenuOption => ({
    id: 'delete',
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
    getAlignmentOptions
  }
}
