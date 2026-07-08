import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const PANEL_MIN_WIDTH = 420
const PANEL_MAX_WIDTH = 960

export const useAgentPanelStore = defineStore('agentPanel', () => {
  // Mirrors the PostHog flag gate (fail-closed): host renders the panel only while on.
  const enabled = ref(false)
  const isOpen = ref(false)
  const width = ref(PANEL_MIN_WIDTH)

  const isMaximized = computed(() => width.value === PANEL_MAX_WIDTH)

  function toggle(): void {
    isOpen.value = !isOpen.value
  }

  function close(): void {
    isOpen.value = false
  }

  function setWidth(px: number): void {
    width.value = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, px))
  }

  function toggleMaximize(): void {
    setWidth(isMaximized.value ? PANEL_MIN_WIDTH : PANEL_MAX_WIDTH)
  }

  return {
    enabled,
    isOpen,
    width,
    isMaximized,
    toggle,
    close,
    setWidth,
    toggleMaximize
  }
})
