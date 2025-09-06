import {
  AlignCenterHorizontal,
  AlignStartHorizontal,
  Expand,
  FolderPlus,
  Frame,
  Group,
  Shrink,
  Trash2
} from 'lucide-vue-next'
import { computed, markRaw } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'

import { useFrameNodes } from './useFrameNodes'
import { BadgeVariant, type MenuOption } from './useMoreOptionsMenu'
import { useNodeArrangement } from './useNodeArrangement'
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

  const { alignOptions, distributeOptions, applyAlign, applyDistribute } =
    useNodeArrangement()

  const { convertToSubgraph, unpackSubgraph, addSubgraphToLibrary } =
    useSubgraphOperations()

  const { frameNodes } = useFrameNodes()

  const alignSubmenu = computed(() =>
    alignOptions.map((align) => ({
      label: align.localizedName,
      icon: align.icon,
      action: () => applyAlign(align)
    }))
  )

  const distributeSubmenu = computed(() =>
    distributeOptions.map((distribute) => ({
      label: distribute.localizedName,
      icon: distribute.icon,
      action: () => applyDistribute(distribute)
    }))
  )

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

  const getSubgraphOptions = (hasSubgraphs: boolean): MenuOption[] => {
    if (hasSubgraphs) {
      return [
        {
          label: t('contextMenu.Add Subgraph to Library'),
          icon: markRaw(FolderPlus),
          action: addSubgraphToLibrary
        },
        {
          label: t('contextMenu.Unpack Subgraph'),
          icon: markRaw(Expand),
          action: unpackSubgraph
        }
      ]
    } else {
      return [
        {
          label: t('contextMenu.Convert to Subgraph'),
          icon: markRaw(Shrink),
          action: convertToSubgraph,
          badge: BadgeVariant.NEW
        }
      ]
    }
  }

  const getMultipleNodesOptions = (): MenuOption[] => {
    const convertToGroupNodes = () => {
      const commandStore = useCommandStore()
      void commandStore.execute(
        'Comfy.GroupNode.ConvertSelectedNodesToGroupNode'
      )
    }

    return [
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
    ]
  }

  const getAlignmentOptions = (): MenuOption[] => [
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
  ]

  const getDeleteOption = (): MenuOption => ({
    label: t('contextMenu.Delete'),
    icon: markRaw(Trash2),
    shortcut: 'Delete',
    action: deleteSelection
  })

  return {
    getBasicSelectionOptions,
    getSubgraphOptions,
    getMultipleNodesOptions,
    getDeleteOption,
    getAlignmentOptions,
    alignSubmenu,
    distributeSubmenu
  }
}
