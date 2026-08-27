import { render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

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

describe('DockedAgentPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('renders nothing while the feature flag is off, even with a stored open state', () => {
    localStorage.setItem('Comfy.AgentPanel.open', 'true')
    render(DockedAgentPanel)

    expect(screen.queryByTestId('docked-agent-panel')).toBeNull()
  })

  it('renders nothing while the panel is closed', () => {
    const store = useAgentPanelStore()
    store.enabled = true
    render(DockedAgentPanel)

    expect(screen.queryByTestId('docked-agent-panel')).toBeNull()
  })

  it('docks the panel at the store width when enabled and open', async () => {
    const store = useAgentPanelStore()
    store.enabled = true
    store.isOpen = true
    render(DockedAgentPanel)
    await nextTick()

    const panel = screen.getByTestId('docked-agent-panel')
    expect(panel.style.width).toBe(`${store.width}px`)
    await screen.findByTestId('agent-panel-root-stub')
  })

  it('undocks when the flag turns off while open', async () => {
    const store = useAgentPanelStore()
    store.enabled = true
    store.isOpen = true
    render(DockedAgentPanel)
    await nextTick()
    expect(screen.getByTestId('docked-agent-panel')).toBeInTheDocument()

    store.enabled = false
    await nextTick()
    expect(screen.queryByTestId('docked-agent-panel')).toBeNull()
  })
})
