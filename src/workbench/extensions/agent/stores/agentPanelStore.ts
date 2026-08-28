import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

const OPEN_STORAGE_KEY = 'Comfy.AgentPanel.open'

export const useAgentPanelStore = /* @__PURE__ */ defineStore(
  'agentPanel',
  () => {
    const enabled = ref(false)
    // writeDefaults false: no storage key planted for flag-off users.
    const isOpen = useLocalStorage(OPEN_STORAGE_KEY, false, {
      writeDefaults: false
    })

    function close(): void {
      isOpen.value = false
    }

    function toggle(): void {
      isOpen.value = !isOpen.value
    }

    return {
      enabled,
      isOpen,
      close,
      toggle
    }
  }
)
