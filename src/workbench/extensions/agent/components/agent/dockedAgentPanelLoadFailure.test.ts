import { render, screen } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { reportError } from '@/platform/telemetry/reportError'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import DockedAgentPanel from './DockedAgentPanel.vue'

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: vi.fn()
}))

// The mocked module factory throws, so the dynamic import itself rejects -
// the chunk-load failure path, distinct from a runtime error inside a
// resolved panel (covered in DockedAgentPanel.test.ts).
vi.mock('@/workbench/extensions/agent/AgentPanelRoot.vue', () => {
  throw new Error('agent panel chunk failed to load')
})

describe('DockedAgentPanel chunk-load failure', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.mocked(reportError).mockClear()
  })

  it('reports the failure and shows the error state when the chunk cannot load', async () => {
    const store = useAgentPanelStore()
    const composer = useAgentComposerStore()
    store.enabled = true
    store.isOpen = true
    composer.draft = 'Keep this prompt after a failed panel load'
    expect(composer.requestSubmission()).toBe(true)
    composer.requestAttachments([
      new File(['reference'], 'reference.png', { type: 'image/png' })
    ])
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })
    // The re-thrown loader error reaches the app handler by design; the
    // stub keeps the test log clean without suppressing the contract.
    render(DockedAgentPanel, {
      global: { plugins: [i18n], config: { errorHandler: () => {} } }
    })

    await screen.findByText('The agent panel failed to load.')
    screen.getByRole('complementary', { name: 'Comfy Agent' })
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'agent_panel_load_failure'
    })
    expect(composer.pendingSubmission).toBeNull()
    expect(composer.pendingAttachmentRequests).toEqual([])
    expect(composer.hasPendingAttachmentWork).toBe(false)
    expect(composer.draft).toBe('Keep this prompt after a failed panel load')
    expect(composer.compactSessionPhase).toBe('idle')
  })
})
