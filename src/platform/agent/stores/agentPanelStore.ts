import { defineStore } from 'pinia'
import { ref } from 'vue'

const PANEL_MIN_WIDTH = 420
const PANEL_MAX_WIDTH = 960

export const useAgentPanelStore = defineStore('agentPanel', () => {
  const isOpen = ref(false)
  const width = ref(PANEL_MIN_WIDTH)

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function setWidth(px: number) {
    width.value = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, px))
  }

  return {
    isOpen,
    width,
    open,
    close,
    toggle,
    setWidth
  }
})
