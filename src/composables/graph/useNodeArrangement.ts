import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Direction } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { alignNodes, distributeNodes } from '@/lib/litegraph/src/utils/arrange'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

import { useCanvasRefresh } from './useCanvasRefresh'

export const ARRANGE_ICON = 'icon-[lucide--align-start-vertical]'

interface AlignOption {
  name: string
  localizedName: string
  value: Direction
  icon: string
}

interface DistributeOption {
  name: string
  localizedName: string
  value: boolean // true for horizontal, false for vertical
  icon: string
}

/**
 * Composable for handling node alignment and distribution
 */
export function useNodeArrangement() {
  const { t } = useI18n()
  const canvasStore = useCanvasStore()
  const canvasRefresh = useCanvasRefresh()
  const canArrange = computed(
    () =>
      !canvasStore.isReadOnly &&
      canvasStore.selectedItems.filter(isLGraphNode).length >= 2
  )
  const alignOptions: AlignOption[] = [
    {
      name: 'top',
      localizedName: t('contextMenu.Align top'),
      value: 'top',
      icon: 'icon-[lucide--align-start-horizontal]'
    },
    {
      name: 'bottom',
      localizedName: t('contextMenu.Align bottom'),
      value: 'bottom',
      icon: 'icon-[lucide--align-end-horizontal]'
    },
    {
      name: 'left',
      localizedName: t('contextMenu.Align left'),
      value: 'left',
      icon: 'icon-[lucide--align-start-vertical]'
    },
    {
      name: 'right',
      localizedName: t('contextMenu.Align right'),
      value: 'right',
      icon: 'icon-[lucide--align-end-vertical]'
    }
  ]

  const distributeOptions: DistributeOption[] = [
    {
      name: 'horizontal',
      localizedName: t('contextMenu.Distribute horizontally'),
      value: true,
      icon: 'icon-[lucide--align-horizontal-distribute-center]'
    },
    {
      name: 'vertical',
      localizedName: t('contextMenu.Distribute vertically'),
      value: false,
      icon: 'icon-[lucide--align-vertical-distribute-center]'
    }
  ]

  const applyAlign = (alignOption: AlignOption, alignTo?: LGraphNode) => {
    const selectedNodes = Array.from(canvasStore.selectedItems).filter((item) =>
      isLGraphNode(item)
    )

    if (selectedNodes.length === 0) {
      return
    }

    const newPositions = alignNodes(selectedNodes, alignOption.value, alignTo)
    canvasStore.canvas?.applyNodePositions(newPositions)

    canvasRefresh.refreshCanvas()
  }

  const applyDistribute = (distributeOption: DistributeOption) => {
    const selectedNodes = Array.from(canvasStore.selectedItems).filter((item) =>
      isLGraphNode(item)
    )

    if (selectedNodes.length < 2) {
      return
    }

    const newPositions = distributeNodes(selectedNodes, distributeOption.value)
    canvasStore.canvas?.applyNodePositions(newPositions)
    canvasRefresh.refreshCanvas()
  }

  return {
    canArrange,
    alignOptions,
    distributeOptions,
    applyAlign,
    applyDistribute
  }
}
