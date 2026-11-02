import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useZipTieToolStore = defineStore('zipTieTool', () => {
  const active = ref(false)

  function toggle() {
    active.value = !active.value
  }

  function deactivate() {
    active.value = false
  }

  return { active, toggle, deactivate }
})
