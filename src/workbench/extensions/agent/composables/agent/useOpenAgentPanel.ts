import { storeToRefs } from 'pinia'
import { onScopeDispose, ref } from 'vue'

import type { AgentPanelOpenedMetadata } from '@comfyorg/telemetry/types'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

export function useOpenAgentPanel(source: AgentPanelOpenedMetadata['source']) {
  const panel = useAgentPanelStore()
  const { enabled } = storeToRefs(panel)
  const isOpening = ref(false)
  let isActive = true
  onScopeDispose(() => {
    isActive = false
  })

  async function open(): Promise<boolean> {
    if (!isActive || !enabled.value || isOpening.value) return false
    if (panel.isVisible) {
      panel.view = { screen: 'chat' }
      return true
    }
    isOpening.value = true
    panel.suppressRestoredOpen()
    let opened = false
    try {
      await useAgentConsent().withConsent('button_click', () => {
        if (!isActive || !enabled.value) return
        panel.view = { screen: 'chat' }
        panel.open(source)
        opened = true
      })
      return opened
    } finally {
      isOpening.value = false
    }
  }

  return { enabled, isOpening, open }
}
