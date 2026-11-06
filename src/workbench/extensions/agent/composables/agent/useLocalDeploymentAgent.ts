import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useDeploymentAgentStore } from '@/workbench/extensions/agent/stores/agent/deploymentAgentStore'

export function useLocalDeploymentAgent() {
  const { flags } = useFeatureFlags()
  const { withConsent } = useAgentConsent()
  const composer = useAgentComposerStore()
  const panel = useAgentPanelStore()
  const workflows = useWorkflowStore()
  const deployment = useDeploymentAgentStore()
  const available = computed(() => flags.agent?.state === 'ready')

  async function open(brief: string): Promise<boolean> {
    const target = workflows.activeWorkflow
    if (!available.value || !target) return false
    let opened = false
    await withConsent('button_click', () => {
      if (
        !available.value ||
        !panel.enabled ||
        workflows.activeWorkflow !== target
      )
        return
      const canSubmit = !composer.hasDraft
      composer.setText([composer.draft, brief].filter(Boolean).join('\n\n'))
      panel.startFollowingVisibleWorkflow()
      panel.view = { screen: 'chat' }
      panel.open()
      if (canSubmit) deployment.request(target.instanceId, brief)
      opened = true
    })
    return opened
  }

  return { available, open }
}
