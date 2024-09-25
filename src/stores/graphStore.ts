import { LGraphNode, LGraphGroup, LGraphCanvas } from '@comfyorg/litegraph'
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

export const useTitleEditorStore = defineStore('titleEditor', () => {
  const titleEditorTarget = shallowRef<LGraphNode | LGraphGroup | null>(null)

  return {
    titleEditorTarget
  }
})

export const useCanvasStore = defineStore('canvas', () => {
  const canvas = shallowRef<LGraphCanvas | null>(null)
  const readOnly = ref(false)

  document.addEventListener(
    'litegraph:canvas',
    (e: CustomEvent<{ subType: string; readOnly: boolean }>) => {
      if (e.detail?.subType === 'read-only') {
        readOnly.value = e.detail.readOnly
      }
    }
  )

  return {
    canvas,
    readOnly
  }
})
