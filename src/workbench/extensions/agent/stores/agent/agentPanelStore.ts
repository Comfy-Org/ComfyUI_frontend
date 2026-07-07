import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Visibility state for the right-docked agent panel (FE-1187). The panel opens from the
 * top-bar "Ask Comfy Agent" button into the host right dock (not a left sidebar tab, per the
 * Figma). `enabled` mirrors the PostHog flag gate (fail-closed), so the host renders the
 * panel only when the feature flag is on; `isOpen` is the user toggle.
 */
export const useAgentPanelStore = defineStore('agentPanel', () => {
  const enabled = ref(false)
  const isOpen = ref(false)

  function toggle(): void {
    isOpen.value = !isOpen.value
  }

  function close(): void {
    isOpen.value = false
  }

  return { enabled, isOpen, toggle, close }
})
