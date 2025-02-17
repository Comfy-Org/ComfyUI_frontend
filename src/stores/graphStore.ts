import type { LGraphCanvas, LGraphGroup, LGraphNode } from '@comfyorg/litegraph'
import type { Positionable } from '@comfyorg/litegraph/dist/interfaces'
import { defineStore } from 'pinia'
import { markRaw, ref, shallowRef } from 'vue'

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
   * The root LGraphCanvas object is shallow reactive.
   */
  const canvas = shallowRef<LGraphCanvas | null>(null)
  /**
   * The selected items on the canvas. All stored items are raw.
   */
  const selectedItems = ref<Positionable[]>([])
  const updateSelectedItems = () => {
    const items = Array.from(canvas.value?.selectedItems ?? [])
    selectedItems.value = items.map((item) => markRaw(item))
  }

  return {
    canvas,
    selectedItems,
    updateSelectedItems
  }
})
