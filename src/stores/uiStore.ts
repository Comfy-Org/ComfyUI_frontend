// UI state that need to be shared across the app
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const selectionToolboxExecuteButtonHovered = ref(false)

  return {
    selectionToolboxExecuteButtonHovered
  }
})
