import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

const PANEL_WIDTH = 420
const OPEN_STORAGE_KEY = 'Comfy.AgentPanel.open'

export const useAgentPanelStore = defineStore('agentPanel', () => {
  const enabled = ref(false)
  const isOpen = useLocalStorage(OPEN_STORAGE_KEY, false)
  const width = ref(PANEL_WIDTH)

  function open(): void {
    if (isOpen.value) return
    isOpen.value = true
  }

  function close(): void {
    if (!isOpen.value) return
    isOpen.value = false
  }

  function toggle(): void {
    if (isOpen.value) close()
    else open()
  }

  return {
    enabled,
    isOpen,
    width,
    open,
    close,
    toggle
  }
})
