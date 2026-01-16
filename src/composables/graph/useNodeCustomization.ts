import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useNodeColorOptions } from '@/composables/graph/useNodeColorOptions'
import type { NodeColorOption } from '@/composables/graph/useNodeColorOptions'
import type { IColorable } from '@/lib/litegraph/src/interfaces'
import {
  LGraphNode,
  RenderShape,
  isColorable
} from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import { useCanvasRefresh } from './useCanvasRefresh'

interface ShapeOption {
  name: string
  localizedName: string
  value: RenderShape
}

/**
 * Composable for handling node color and shape customization
 */
export function useNodeCustomization() {
  const { t } = useI18n()
  const canvasStore = useCanvasStore()
  const canvasRefresh = useCanvasRefresh()

  // Use shared color options logic
  const {
    colorOptions,
    NO_COLOR_OPTION,
    applyColorToItems,
    getCurrentColorName,
    isLightTheme
  } = useNodeColorOptions()

  // Shape options
  const shapeOptions: ShapeOption[] = [
    {
      name: 'default',
      localizedName: t('shape.default'),
      value: RenderShape.ROUND
    },
    {
      name: 'box',
      localizedName: t('shape.box'),
      value: RenderShape.BOX
    },
    {
      name: 'card',
      localizedName: t('shape.CARD'),
      value: RenderShape.CARD
    }
  ]

  const applyColor = (colorOption: NodeColorOption | null) => {
    const colorName = colorOption?.name ?? NO_COLOR_OPTION.value.name

    const colorableItems = Array.from(canvasStore.selectedItems)
      .filter(isColorable)
      .map((item) => item as unknown as IColorable)
    applyColorToItems(colorableItems, colorName)

    canvasRefresh.refreshCanvas()
  }

  const applyShape = (shapeOption: ShapeOption) => {
    const selectedNodes = Array.from(canvasStore.selectedItems).filter(
      (item): item is LGraphNode => item instanceof LGraphNode
    )

    if (selectedNodes.length === 0) {
      return
    }

    selectedNodes.forEach((node) => {
      node.shape = shapeOption.value
    })

    canvasRefresh.refreshCanvas()
  }

  const getCurrentColor = (): NodeColorOption | null => {
    const selectedItems = Array.from(canvasStore.selectedItems)
    if (selectedItems.length === 0) return null

    const colorableItems = selectedItems
      .filter(isColorable)
      .map((item) => item as unknown as IColorable)
    if (colorableItems.length === 0) return null

    const currentColorName = getCurrentColorName(colorableItems)
    if (!currentColorName) return null

    return (
      colorOptions.value.find((option) => option.name === currentColorName) ??
      NO_COLOR_OPTION.value
    )
  }

  const getCurrentShape = (): ShapeOption | null => {
    const selectedNodes = Array.from(canvasStore.selectedItems).filter(
      (item): item is LGraphNode => item instanceof LGraphNode
    )

    if (selectedNodes.length === 0) return null

    const firstNode = selectedNodes[0]
    const currentShape = firstNode.shape ?? RenderShape.ROUND

    return (
      shapeOptions.find((option) => option.value === currentShape) ??
      shapeOptions[0]
    )
  }

  return {
    colorOptions: computed(() => colorOptions.value),
    shapeOptions,
    applyColor,
    applyShape,
    getCurrentColor,
    getCurrentShape,
    isLightTheme
  }
}
