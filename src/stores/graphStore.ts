import { LGraphCanvas, LGraphGroup, LGraphNode } from '@comfyorg/litegraph'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

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

  return {
    canvas
  }
})
