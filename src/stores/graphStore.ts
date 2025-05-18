import type { LGraphCanvas, LGraphGroup, LGraphNode } from '@comfyorg/litegraph'
import type { Positionable } from '@comfyorg/litegraph/dist/interfaces'
import { defineStore } from 'pinia'
import { type Raw, computed, markRaw, ref, shallowRef } from 'vue'

import { isLGraphGroup, isLGraphNode } from '@/utils/litegraphUtil'

export const useTitleEditorStore = defineStore('titleEditor', () => {
  const titleEditorTarget = shallowRef<LGraphNode | LGraphGroup | null>(null)

  return {
    titleEditorTarget
  }
})

export const useCanvasStore = defineStore('canvas', () => {
  /**
   * The LGraphCanvas instance.
   *
   * The root LGraphCanvas object is a shallow ref.
   */
  const canvas = shallowRef<LGraphCanvas | null>(null)
  /**
   * The selected items on the canvas. All stored items are raw.
   */
  const selectedItems = ref<Raw<Positionable>[]>([])
  const updateSelectedItems = () => {
    const items = Array.from(canvas.value?.selectedItems ?? [])
    selectedItems.value = items.map((item) => markRaw(item))
  }

  const nodeSelected = computed(() => selectedItems.value.some(isLGraphNode))
  const groupSelected = computed(() => selectedItems.value.some(isLGraphGroup))

  const getCanvas = () => {
    if (!canvas.value) throw new Error('getCanvas: canvas is null')
    return canvas.value
  }

  return {
    canvas,
    selectedItems,
    nodeSelected,
    groupSelected,
    updateSelectedItems,
    getCanvas
  }
})
