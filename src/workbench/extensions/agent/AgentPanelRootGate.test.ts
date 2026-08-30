import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

vi.mock('./AgentPanelRuntimeRoot.vue', () => ({
  __isKeepAlive: false,
  __isTeleport: false,
  name: 'AgentPanelRuntimeRoot',
  default: { template: '<div>Agent runtime mounted</div>' }
}))

import AgentPanelRoot from './AgentPanelRoot.vue'

describe('AgentPanelRoot gate', () => {
  beforeEach(() => {
    api.serverFeatureFlags.value = {}
  })

  it('mounts the runtime only while the feature flag is enabled', async () => {
    render(AgentPanelRoot)

    expect(screen.queryByText('Agent runtime mounted')).not.toBeInTheDocument()

    api.serverFeatureFlags.value = { 'agent-in-app-experience': true }
    expect(await screen.findByText('Agent runtime mounted')).toBeInTheDocument()

    api.serverFeatureFlags.value = { 'agent-in-app-experience': false }
    await waitFor(() =>
      expect(
        screen.queryByText('Agent runtime mounted')
      ).not.toBeInTheDocument()
    )
  })
})
