import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSharePanelStore = defineStore('sharePanel', () => {
  const isOpen = ref(false)

  function openPanel() {
    isOpen.value = true
  }

  function closePanel() {
    isOpen.value = false
  }

  function togglePanel() {
    isOpen.value = !isOpen.value
  }

  return {
    isOpen,
    openPanel,
    closePanel,
    togglePanel
  }
})
