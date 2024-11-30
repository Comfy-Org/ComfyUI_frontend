import { LGraphNode, LGraphGroup, LGraphCanvas } from '@comfyorg/litegraph'
import type { ComfyNodeItem } from '@/types/comfy'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export const useTitleEditorStore = defineStore('titleEditor', () => {
  const titleEditorTarget = shallowRef<LGraphNode | LGraphGroup | null>(null)

  return {
    titleEditorTarget
  }
})

export const useHoveredItemStore = defineStore('hoveredItem', () => {
  const hoveredItem = shallowRef<ComfyNodeItem | null>(null)

  return {
    hoveredItem
  }
})

export const useCanvasStore = defineStore('canvas', () => {
  /**
   * The LGraphCanvas instance.
   *
   * The root LGraphCanvas object is shallow reactive.
   */
  const canvas = shallowRef<LGraphCanvas | null>(null)

  return {
    canvas
  }
})
