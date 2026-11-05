import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

export function useLocalDeploymentAgent() {
  const { flags } = useFeatureFlags()
  const { withConsent } = useAgentConsent()
  const composer = useAgentComposerStore()
  const panel = useAgentPanelStore()
  const available = computed(() => flags.agent?.state === 'ready')

  async function open(brief: string): Promise<boolean> {
    if (!available.value) return false
    let opened = false
    await withConsent('button_click', () => {
      if (!available.value || !panel.enabled) return
      composer.setText([composer.draft, brief].filter(Boolean).join('\n\n'))
      panel.startFollowingVisibleWorkflow()
      panel.view = { screen: 'chat' }
      panel.open()
      opened = true
    })
    return opened
  }

  return { available, open }
}
