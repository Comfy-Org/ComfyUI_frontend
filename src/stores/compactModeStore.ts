import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCompactModeStore = defineStore('compactMode', () => {
  const isCompactMode = ref(false)

  function toggle() {
    isCompactMode.value = !isCompactMode.value
  }

  function set(value: boolean) {
    isCompactMode.value = value
  }

  return {
    isCompactMode,
    toggle,
    set
  }
})
