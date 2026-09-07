import { render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentPanelStore } from './stores/agent/agentPanelStore'

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => undefined
}))

vi.mock('./AgentPanelRuntimeRoot.vue', () => ({
  default: { template: '<div>Agent runtime mounted</div>' }
}))

import AgentPanelRoot from './AgentPanelRoot.vue'

describe('AgentPanelRoot gate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('mounts the runtime only while the feature is enabled', async () => {
    const store = useAgentPanelStore()
    render(AgentPanelRoot)

    expect(screen.queryByText('Agent runtime mounted')).not.toBeInTheDocument()

    store.enabled = true
    expect(await screen.findByText('Agent runtime mounted')).toBeInTheDocument()

    store.enabled = false
    await vi.waitFor(() =>
      expect(
        screen.queryByText('Agent runtime mounted')
      ).not.toBeInTheDocument()
    )
  })
})
