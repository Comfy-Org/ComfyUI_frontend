import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useHelpCenterStore = defineStore('helpCenter', () => {
  const isVisible = ref(false)

  function toggle() {
    isVisible.value = !isVisible.value
  }

  function show() {
    isVisible.value = true
  }

  function hide() {
    isVisible.value = false
  }

  return {
    isVisible,
    toggle,
    show,
    hide
  }
})
