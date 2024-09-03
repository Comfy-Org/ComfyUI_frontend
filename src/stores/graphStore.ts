import { LGraphNode, LGraphGroup } from '@comfyorg/litegraph'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTitleEditorStore = defineStore('titleEditor', () => {
  const titleEditorTarget = ref<LGraphNode | LGraphGroup | null>(null)

  return {
    titleEditorTarget
  }
})
