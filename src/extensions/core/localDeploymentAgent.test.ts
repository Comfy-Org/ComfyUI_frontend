import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { computed } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { localDeploymentAgentExtension } from '@/extensions/core/localDeploymentAgent'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import DeploySetupCard from '@/platform/openOnCloud/components/DeploySetupCard.vue'
import { openDeploySetupDialog } from '@/platform/openOnCloud/openRunOnCloudDialog'
import { useDialogStore } from '@/stores/dialogStore'
import { testI18n } from '@/utils/__tests__/testI18n'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(
  import('@/workbench/extensions/agent/composables/agent/useAgentConsent')
)

describe('Deployment dialog local-agent handoff', () => {
  it('dismisses the dialog so the user can continue with the prepared local agent', async () => {
    vi.mocked(useFeatureFlags().flags).agent = { state: 'ready' }
    vi.mocked(useAgentConsent).mockReturnValue({
      accepted: computed(() => true),
      isChecking: computed(() => false),
      withConsent: async (_trigger, onAccept) => onAccept(),
      resumeAcceptAfterReload: async () => {}
    })
    const panel = useAgentPanelStore()
    panel.enabled = true
    useCommandStore().loadExtensionCommands(localDeploymentAgentExtension)
    await openDeploySetupDialog()
    render(DeploySetupCard, {
      global: { plugins: [testI18n] }
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Build with your agent' })
    )
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Use local agent' })
    )

    await waitFor(() =>
      expect(useDialogStore().isDialogOpen('global-run-on-comfy-cloud')).toBe(
        false
      )
    )
    expect(panel.isVisible).toBe(true)
    expect(useAgentComposerStore().draft).toContain('Comfy API Build')
  })
})
