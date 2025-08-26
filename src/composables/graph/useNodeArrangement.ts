import { type Component, markRaw } from 'vue'
import ILucideAlignCenterHorizontal from '~icons/lucide/align-center-horizontal'
import ILucideAlignCenterVertical from '~icons/lucide/align-center-vertical'
import ILucideAlignEndHorizontal from '~icons/lucide/align-end-horizontal'
import ILucideAlignEndVertical from '~icons/lucide/align-end-vertical'
import ILucideAlignStartHorizontal from '~icons/lucide/align-start-horizontal'
import ILucideAlignStartVertical from '~icons/lucide/align-start-vertical'

import type { Direction } from '@/lib/litegraph/src/interfaces'
import { alignNodes, distributeNodes } from '@/lib/litegraph/src/utils/arrange'
import { useCanvasStore } from '@/stores/graphStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { isLGraphNode } from '@/utils/litegraphUtil'

export interface AlignOption {
  name: string
  localizedName: string
  value: Direction
  icon: Component
}

export interface DistributeOption {
  name: string
  localizedName: string
  value: boolean // true for horizontal, false for vertical
  icon: Component
}

/**
 * Composable for handling node alignment and distribution
 */
export function useNodeArrangement() {
  const canvasStore = useCanvasStore()
  const workflowStore = useWorkflowStore()

  const alignOptions: AlignOption[] = [
    {
      name: 'top',
      localizedName: 'Top',
      value: 'top',
      icon: markRaw(ILucideAlignStartVertical)
    },
    {
      name: 'bottom',
      localizedName: 'Bottom',
      value: 'bottom',
      icon: markRaw(ILucideAlignEndVertical)
    },
    {
      name: 'left',
      localizedName: 'Left',
      value: 'left',
      icon: markRaw(ILucideAlignStartHorizontal)
    },
    {
      name: 'right',
      localizedName: 'Right',
      value: 'right',
      icon: markRaw(ILucideAlignEndHorizontal)
    }
  ]

  const distributeOptions: DistributeOption[] = [
    {
      name: 'horizontal',
      localizedName: 'Horizontal',
      value: true,
      icon: markRaw(ILucideAlignCenterHorizontal)
    },
    {
      name: 'vertical',
      localizedName: 'Vertical',
      value: false,
      icon: markRaw(ILucideAlignCenterVertical)
    }
  ]

  const applyAlign = (alignOption: AlignOption) => {
    const selectedNodes = Array.from(canvasStore.selectedItems).filter((item) =>
      isLGraphNode(item)
    )

    if (selectedNodes.length === 0) {
      return
    }

    canvasStore.canvas?.emitBeforeChange()
    alignNodes(selectedNodes, alignOption.value)
    canvasStore.canvas?.setDirty(true, true)
    canvasStore.canvas?.graph?.afterChange()
    canvasStore.canvas?.emitAfterChange()
    workflowStore.activeWorkflow?.changeTracker?.checkState()
  }

  const applyDistribute = (distributeOption: DistributeOption) => {
    const selectedNodes = Array.from(canvasStore.selectedItems).filter((item) =>
      isLGraphNode(item)
    )

    if (selectedNodes.length < 2) {
      return
    }

    canvasStore.canvas?.emitBeforeChange()
    distributeNodes(selectedNodes, distributeOption.value)
    canvasStore.canvas?.setDirty(true, true)
    canvasStore.canvas?.graph?.afterChange()
    canvasStore.canvas?.emitAfterChange()
    workflowStore.activeWorkflow?.changeTracker?.checkState()
  }

  return {
    alignOptions,
    distributeOptions,
    applyAlign,
    applyDistribute
  }
}
