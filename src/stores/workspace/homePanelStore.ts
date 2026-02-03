import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useHomePanelStore = defineStore('homePanel', () => {
  const isOpen = useLocalStorage('Comfy.HomePanel.Open', false)

  const openPanel = () => {
    isOpen.value = true
  }

  const closePanel = () => {
    isOpen.value = false
  }

  const togglePanel = () => {
    isOpen.value = !isOpen.value
  }

  return {
    isOpen,
    openPanel,
    closePanel,
    togglePanel
  }
})
