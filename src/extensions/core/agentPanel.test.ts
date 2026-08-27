import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const posthogState = vi.hoisted(() => ({
  flag: undefined as boolean | undefined,
  listeners: [] as Array<() => void>
}))

vi.mock('posthog-js', () => ({
  default: {
    isFeatureEnabled: () => posthogState.flag,
    onFeatureFlags: (listener: () => void) => {
      posthogState.listeners.push(listener)
      return () => {}
    }
  }
}))

const registered = vi.hoisted(() => ({
  setup: null as (() => void) | null
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: (extension: { setup?: () => void }) => {
      registered.setup = extension.setup ?? null
    }
  })
}))

async function bootGate(): Promise<void> {
  vi.resetModules()
  await import('./agentPanel')
  registered.setup?.()
  // Let the async setupFlagGate settle its first sync.
  await vi.waitFor(() => {
    if (document.body.dataset.agentGateSettled !== 'true') {
      throw new Error('gate not settled')
    }
  })
}

function flipFlag(value: boolean): void {
  posthogState.flag = value
  for (const listener of posthogState.listeners) listener()
}

describe('the agent panel flag gate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    delete document.body.dataset.agentGateSettled
    posthogState.flag = undefined
    posthogState.listeners = []
    registered.setup = null
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  it('enables the panel when the flag resolves on', async () => {
    posthogState.flag = true
    await bootGate()

    expect(useAgentPanelStore().enabled).toBe(true)
  })

  it('stays disabled when the flag resolves off', async () => {
    posthogState.flag = false
    await bootGate()

    expect(useAgentPanelStore().enabled).toBe(false)
  })

  it('propagates a post-boot flag flip into the store', async () => {
    posthogState.flag = false
    await bootGate()
    expect(useAgentPanelStore().enabled).toBe(false)

    flipFlag(true)

    expect(useAgentPanelStore().enabled).toBe(true)
  })

  it('recovers when setup wins the race against posthog initialization', async () => {
    // Flags unresolved at boot: isFeatureEnabled returns undefined.
    posthogState.flag = undefined
    vi.resetModules()
    await import('./agentPanel')
    registered.setup?.()
    await Promise.resolve()
    expect(useAgentPanelStore().enabled).toBe(false)

    // Flags resolve later; the bounded retry re-takes the subscription.
    posthogState.flag = true
    await vi.advanceTimersByTimeAsync(2100)

    expect(useAgentPanelStore().enabled).toBe(true)
    expect(document.body.dataset.agentGateSettled).toBe('true')
  })

  it('fails closed without an unhandled rejection when the SDK import is blocked', async () => {
    // The hoisted mock registry survives resetModules, so override per-test.
    vi.doMock('posthog-js', () => {
      throw new Error('blocked by ad blocker')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await bootGate()
    vi.doUnmock('posthog-js')

    expect(useAgentPanelStore().enabled).toBe(false)
    expect(consoleError).toHaveBeenCalledWith(
      '[Comfy.AgentPanel] feature-flag gate failed to load',
      expect.any(Error)
    )
    consoleError.mockRestore()
  })
})
