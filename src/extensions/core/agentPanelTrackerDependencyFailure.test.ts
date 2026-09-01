import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const registered = vi.hoisted(() => ({
  setup: null as (() => Promise<void> | void) | null
}))

// The inverted leg of the same Promise.all the sibling suite probes: there the
// gate fails and the tracker is stubbed healthy; here the tracker's chunk fails
// and the gate must still reach a settled state rather than hang the panel.
vi.mock(
  '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker',
  () => {
    throw new Error('tracker chunk failed to load')
  }
)

vi.mock('@/workbench/extensions/agent/utils/postHogFlagSource', () => ({
  AGENT_PANEL_FLAG: 'agent-panel',
  FLAG_SETTLE_TIMEOUT_MS: 0,
  createPostHogFlagSource: () => ({
    isEnabled: () => false,
    onChange: (callback: () => void) => callback()
  })
}))

vi.mock('posthog-js', () => ({ default: {} }))

vi.mock('@/utils/devFeatureFlagOverride', () => ({
  getDevOverride: () => undefined
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: (extension: { setup?: () => Promise<void> | void }) => {
      registered.setup = extension.setup ?? null
    }
  })
}))

describe('the agent panel gate under a tracker-chunk failure', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('settles the gate even though the sibling registration rejects', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    vi.resetModules()
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()

    // Promise.all surfaces the tracker's rejection, which the extension
    // service's per-extension catch owns in production.
    await expect(registered.setup?.()).rejects.toThrow()

    // The rejection lands before the gate's own dynamic imports resolve, so
    // the settle is awaited rather than read straight after: asserting it
    // synchronously here is the timing false positive this pin exists past.
    await vi.waitFor(() => expect(useAgentPanelStore().gateSettled).toBe(true))
  })
})
