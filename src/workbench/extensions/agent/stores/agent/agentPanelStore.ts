import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import type { AgentPanelCloseSource } from '@/platform/telemetry/types'

const PANEL_MIN_WIDTH = 420
const PANEL_MAX_WIDTH = 960
const OPEN_STORAGE_KEY = 'Comfy.AgentPanel.open'

export const useAgentPanelStore = defineStore('agentPanel', () => {
  const enabled = ref(false)
  const isOpen = useLocalStorage(OPEN_STORAGE_KEY, false)
  const width = ref(PANEL_MIN_WIDTH)

  let openedAt: number | null = null

  watch(
    () => enabled.value && isOpen.value,
    (docked) => {
      if (!docked || openedAt !== null) return
      openedAt = Date.now()
      useTelemetry()?.trackAgentPanelOpened({ source: 'restored' })
    }
  )

  const isMaximized = computed(() => width.value === PANEL_MAX_WIDTH)

  function open(): void {
    if (isOpen.value) return
    isOpen.value = true
    openedAt = Date.now()
    useTelemetry()?.trackAgentPanelOpened({ source: 'topbar_button' })
  }

  function close(source: AgentPanelCloseSource): void {
    if (!isOpen.value) return
    isOpen.value = false
    const openDurationMs = openedAt === null ? null : Date.now() - openedAt
    openedAt = null
    useTelemetry()?.trackAgentPanelClosed({
      source,
      open_duration_ms: openDurationMs
    })
  }

  function toggle(): void {
    if (isOpen.value) close('topbar_button')
    else open()
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
