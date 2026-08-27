import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import AgentPanelRoot from './AgentPanelRoot.vue'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'

function renderRoot() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return render(AgentPanelRoot, { global: { plugins: [i18n] } })
}

describe('AgentPanelRoot', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('closes the panel from its close button', async () => {
    const store = useAgentPanelStore()
    store.enabled = true
    store.isOpen = true
    const user = userEvent.setup()
    renderRoot()

    await user.click(screen.getByRole('button', { name: enMessages.g.close }))

    expect(store.isOpen).toBe(false)
  })
})
