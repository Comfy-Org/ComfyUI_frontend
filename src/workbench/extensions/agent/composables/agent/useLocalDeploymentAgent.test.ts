import { computed } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useLocalDeploymentAgent } from '@/workbench/extensions/agent/composables/agent/useLocalDeploymentAgent'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(
  import('@/workbench/extensions/agent/composables/agent/useAgentConsent')
)

function consent(accepted: boolean) {
  vi.mocked(useAgentConsent).mockReturnValue({
    accepted: computed(() => accepted),
    isChecking: computed(() => false),
    withConsent: async (_trigger, onAccept) => {
      if (accepted) onAccept()
    },
    resumeAcceptAfterReload: async () => {}
  })
}

describe(useLocalDeploymentAgent, () => {
  it('hands the deployment brief to the available local agent after consent', async () => {
    vi.mocked(useFeatureFlags().flags).agent = { state: 'ready' }
    consent(true)
    const panel = useAgentPanelStore()
    panel.enabled = true
    panel.view = {
      screen: 'history',
      previousThreadId: null,
      selection: { status: 'idle' }
    }
    const composer = useAgentComposerStore()
    composer.setText('Keep my earlier instructions')
    const agent = useLocalDeploymentAgent()

    const opened = await agent.open('Deploy this workflow on Comfy Cloud')

    expect(opened).toBe(true)
    expect(panel.isVisible).toBe(true)
    expect(panel.view.screen).toBe('chat')
    expect(composer.draft).toBe(
      'Keep my earlier instructions\n\nDeploy this workflow on Comfy Cloud'
    )
  })

  it('leaves the draft and panel unchanged when consent is declined', async () => {
    vi.mocked(useFeatureFlags().flags).agent = { state: 'ready' }
    consent(false)
    const panel = useAgentPanelStore()
    panel.isOpen = false
    const composer = useAgentComposerStore()
    composer.setText('Keep this')
    const agent = useLocalDeploymentAgent()

    const opened = await agent.open('Deploy this workflow')

    expect(opened).toBe(false)
    expect(panel.isOpen).toBe(false)
    expect(composer.draft).toBe('Keep this')
  })

  it('does not open an agent that the server has not reported ready', async () => {
    vi.mocked(useFeatureFlags().flags).agent = { state: 'starting' }
    consent(true)
    const panel = useAgentPanelStore()
    panel.isOpen = false
    const composer = useAgentComposerStore()
    const agent = useLocalDeploymentAgent()

    await agent.open('Deploy this workflow')

    expect(agent.available.value).toBe(false)
    expect(panel.isOpen).toBe(false)
    expect(composer.draft).toBe('')
  })
})
