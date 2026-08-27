import { render, screen } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import DockedAgentPanel from './DockedAgentPanel.vue'

vi.mock('@/workbench/extensions/agent/AgentPanelRoot.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    __esModule: true,
    default: defineComponent({
      name: 'AgentPanelRoot',
      setup() {
        return () => h('div', { 'data-testid': 'agent-panel-root-stub' })
      }
    })
  }
})

function renderPanel() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return render(DockedAgentPanel, { global: { plugins: [i18n] } })
}

describe('DockedAgentPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('renders nothing while the feature flag is off, even with a stored open state', () => {
    localStorage.setItem('Comfy.AgentPanel.open', 'true')
    renderPanel()

    expect(screen.queryByTestId('docked-agent-panel')).toBeNull()
  })

  it('renders nothing while the panel is closed', () => {
    const store = useAgentPanelStore()
    store.enabled = true
    renderPanel()

    expect(screen.queryByTestId('docked-agent-panel')).toBeNull()
  })

  it('docks the panel when enabled and open', async () => {
    const store = useAgentPanelStore()
    store.enabled = true
    store.isOpen = true
    renderPanel()
    await nextTick()

    screen.getByTestId('docked-agent-panel')
    await screen.findByTestId('agent-panel-root-stub')
  })

  it('undocks when the flag turns off while open', async () => {
    const store = useAgentPanelStore()
    store.enabled = true
    store.isOpen = true
    renderPanel()
    await nextTick()
    expect(screen.getByTestId('docked-agent-panel')).toBeInTheDocument()

    store.enabled = false
    await nextTick()
    expect(screen.queryByTestId('docked-agent-panel')).toBeNull()
  })
})
