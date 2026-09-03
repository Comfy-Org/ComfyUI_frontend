import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type { AgentPanelCloseSource } from '@/platform/telemetry/types'

import { useAgentConsentStore } from './agentConsentStore'

const PANEL_MIN_WIDTH = 420
const PANEL_MAX_WIDTH = 960
const OPEN_STORAGE_KEY = 'Comfy.AgentPanel.open'

export const useAgentPanelStore = defineStore('agentPanel', () => {
  const consentStore = useAgentConsentStore()
  const { isLoggedIn } = useCurrentUser()
  const enabled = ref(false)
  const isOpen = useLocalStorage(OPEN_STORAGE_KEY, false)
  const width = ref(PANEL_MIN_WIDTH)
  const dismissedSelectionSignature = ref<string | null>(null)

  let openedAt: number | null = null

  const isVisible = computed(
    () =>
      enabled.value &&
      isOpen.value &&
      consentStore.accepted &&
      (isCloud || isLoggedIn.value)
  )

  watch(isVisible, (visible) => {
    if (!visible || openedAt !== null) return
    openedAt = Date.now()
    useTelemetry()?.trackAgentPanelOpened({ source: 'restored' })
  })

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

  function suppressRestoredOpen(): void {
    if (!isOpen.value || isVisible.value) return
    isOpen.value = false
    openedAt = null
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
    isVisible,
    width,
    isMaximized,
    dismissedSelectionSignature,
    open,
    toggle,
    close,
    suppressRestoredOpen,
    setWidth,
    toggleMaximize
  }
})
