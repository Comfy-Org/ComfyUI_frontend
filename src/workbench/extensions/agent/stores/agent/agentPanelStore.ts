import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// Dock geometry per the design reference: 420px default, 960px maximized, drag-resizable
// between the two.
const PANEL_MIN_WIDTH = 420
const PANEL_MAX_WIDTH = 960

/**
 * Visibility + geometry state for the right-docked agent panel (FE-1187). The panel opens
 * from the tab-bar "Ask Comfy Agent" button into a full-viewport-height right column.
 * `enabled` mirrors the PostHog flag gate (fail-closed), so the host renders the button and
 * panel only while the feature flag is on; `isOpen` is the user toggle; `width` is the
 * dock's pixel width (drag-resize clamps into [min, max], the header icon toggles the two
 * extremes).
 */
export const useAgentPanelStore = defineStore('agentPanel', () => {
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
