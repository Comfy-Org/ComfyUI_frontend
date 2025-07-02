import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRightSidebarTabStore = defineStore('rightSidebarTab', () => {
  const isVisible = ref(false)

  const toggleVisibility = () => {
    isVisible.value = !isVisible.value
  }

  const show = () => {
    isVisible.value = true
  }

  const hide = () => {
    isVisible.value = false
  }

  return {
    isVisible,
    toggleVisibility,
    show,
    hide
  }
})
