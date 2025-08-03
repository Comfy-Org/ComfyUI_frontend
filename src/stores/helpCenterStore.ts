import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useHelpCenterStore = defineStore('helpCenter', () => {
  const isVisible = ref(false)

  const toggle = () => {
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
    toggle,
    show,
    hide
  }
})
