import { render, screen } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'
import { computed } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { reportError } from '@comfyorg/telemetry/reportError'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useAgentRunModeStore } from '@/workbench/extensions/agent/stores/agent/agentRunModeStore'
import { useProactiveGreetingAssignment } from '@/workbench/extensions/agent/composables/agent/useProactiveGreetingAssignment'

import DockedAgentPanel from './DockedAgentPanel.vue'

vi.mock(import('@comfyorg/telemetry'))
vi.mock(
  import('@/workbench/extensions/agent/composables/agent/useProactiveGreetingAssignment')
)

// The mocked module factory throws, so the dynamic import itself rejects -
// the chunk-load failure path, distinct from a runtime error inside a
// resolved panel (covered in DockedAgentPanel.test.ts).
vi.mock(import('@/workbench/extensions/agent/AgentPanelRoot.vue'), () => {
  throw new Error('agent panel chunk failed to load')
})

describe('DockedAgentPanel chunk-load failure', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(reportError).mockClear()
    vi.spyOn(useAgentRunModeStore(), 'load').mockResolvedValue()
    vi.mocked(useProactiveGreetingAssignment).mockReturnValue(
      computed(() => undefined)
    )
  })

  it('reports the failure and shows the error state when the chunk cannot load', async () => {
    const store = useAgentPanelStore()
    store.enabled = true
    store.consentAccepted = true
    store.isOpen = true
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })
    render(DockedAgentPanel, {
      global: { plugins: [i18n], config: { errorHandler: () => {} } }
    })

    await screen.findByText('The agent panel failed to load.')
    screen.getByRole('complementary', { name: 'Comfy Agent' })
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        cause: new Error('agent panel chunk failed to load')
      }),
      {
        surface: 'agent',
        errorType: 'agent_panel_load_failure'
      }
    )
  })
})
