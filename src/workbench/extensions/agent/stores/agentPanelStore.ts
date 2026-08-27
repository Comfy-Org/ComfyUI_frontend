import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

const OPEN_STORAGE_KEY = 'Comfy.AgentPanel.open'

export const useAgentPanelStore = defineStore('agentPanel', () => {
  const enabled = ref(false)
  // writeDefaults false: flag-off users should not get a storage key planted
  // for a feature they cannot see.
  const isOpen = useLocalStorage(OPEN_STORAGE_KEY, false, {
    writeDefaults: false
  })
  /** True once the flag gate reached a terminal state (delivered, timed out, or failed closed). */
  const gateSettled = ref(false)

  function close(): void {
    isOpen.value = false
  }

  function toggle(): void {
    isOpen.value = !isOpen.value
  }

  return {
    enabled,
    isOpen,
    gateSettled,
    close,
    toggle
  }
})
