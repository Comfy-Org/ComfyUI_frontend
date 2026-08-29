import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import AgentPanelRoot from './AgentPanelRoot.vue'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agentPanelStore'

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

  it('titles the panel with a heading the dock landmark can reference', () => {
    renderRoot()

    const heading = screen.getByRole('heading', {
      name: enMessages.agent.title
    })
    expect(heading.id).toBe('agent-panel-title')
  })

  it('closes the panel from its close button', async () => {
    const store = useAgentPanelStore()
    store.isOpen = true
    const user = userEvent.setup()
    renderRoot()

    await user.click(screen.getByRole('button', { name: enMessages.g.close }))

    expect(store.isOpen).toBe(false)
  })
})
