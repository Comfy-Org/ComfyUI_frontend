import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agentPanelStore'
import { FLAG_SETTLE_TIMEOUT_MS } from '@/workbench/extensions/agent/utils/postHogFlagSource'

const posthogState = vi.hoisted(() => ({
  flag: undefined as boolean | undefined,
  listeners: [] as Array<
    (
      flags?: string[],
      variants?: Record<string, unknown>,
      context?: { errorsLoading?: boolean }
    ) => void
  >
}))

// Mirrors the full posthog bundle's real contract (probe-verified): the
// featureFlags extension exists from the constructor, so a subscription
// registers pre-init and survives init(); an absent or off flag reads as
// undefined.
vi.mock('posthog-js', () => ({
  default: {
    isFeatureEnabled: () => posthogState.flag,
    onFeatureFlags: (
      listener: (
        flags?: string[],
        variants?: Record<string, unknown>,
        context?: { errorsLoading?: boolean }
      ) => void
    ) => {
      posthogState.listeners.push(listener)
      return () => {
        posthogState.listeners = posthogState.listeners.filter(
          (registered) => registered !== listener
        )
      }
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
  // The mocked dynamic import resolves through the module runner, not a
  // bare microtask - wait for the subscription to actually land.
  await vi.waitFor(() => {
    if (posthogState.listeners.length === 0) {
      throw new Error('gate not subscribed yet')
    }
  })
}

async function bootGateExpectingImportFailure(): Promise<void> {
  vi.resetModules()
  await import('./agentPanel')
  registered.setup?.()
  await vi.waitFor(() => {
    if (!useAgentPanelStore().gateSettled) {
      throw new Error('gate not settled yet')
    }
  })
}

function deliverFlags(value: boolean | undefined): void {
  posthogState.flag = value
  for (const listener of posthogState.listeners) listener()
}

describe('the agent panel flag gate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    posthogState.flag = undefined
    posthogState.listeners = []
    registered.setup = null
  })

  it('registers its subscription pre-init and enables on the flags delivery', async () => {
    await bootGate()
    expect(posthogState.listeners.length).toBeGreaterThan(0)
    expect(useAgentPanelStore().enabled).toBe(false)
    expect(useAgentPanelStore().gateSettled).toBe(false)

    deliverFlags(true)

    expect(useAgentPanelStore().enabled).toBe(true)
    expect(useAgentPanelStore().gateSettled).toBe(true)
  })

  it('stays disabled and settles on the delivery when the flag is off', async () => {
    await bootGate()

    // posthog drops false-valued bootstrap flags and reports an absent key
    // as undefined - the off state IS undefined, never false; the delivery
    // itself still settles the gate.
    deliverFlags(undefined)

    expect(useAgentPanelStore().enabled).toBe(false)
    expect(useAgentPanelStore().gateSettled).toBe(true)
  })

  it('settles fail-closed by timeout when no delivery ever arrives', async () => {
    // Fake timers must be installed BEFORE boot so the settle timeout is
    // fake-scheduled; the boot wait advances in 1ms steps, far below the
    // settle budget, so it cannot fire the timeout early.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.resetModules()
    await import('./agentPanel')
    registered.setup?.()
    for (let i = 0; i < 200 && posthogState.listeners.length === 0; i++) {
      await vi.advanceTimersByTimeAsync(1)
    }
    expect(posthogState.listeners.length).toBeGreaterThan(0)
    expect(useAgentPanelStore().gateSettled).toBe(false)

    await vi.advanceTimersByTimeAsync(FLAG_SETTLE_TIMEOUT_MS + 100)

    expect(useAgentPanelStore().enabled).toBe(false)
    expect(useAgentPanelStore().gateSettled).toBe(true)
  })

  it('propagates a post-boot flag flip into the store', async () => {
    await bootGate()
    deliverFlags(true)
    expect(useAgentPanelStore().enabled).toBe(true)

    deliverFlags(undefined)
    expect(useAgentPanelStore().enabled).toBe(false)

    deliverFlags(true)
    expect(useAgentPanelStore().enabled).toBe(true)
  })

  it('force-enables dev builds before any posthog work, even a blocked import', async () => {
    vi.stubEnv('MODE', 'development')
    vi.doMock('posthog-js', () => {
      throw new Error('blocked by ad blocker')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await bootGateExpectingImportFailure()
    vi.doUnmock('posthog-js')
    vi.unstubAllEnvs()

    expect(useAgentPanelStore().enabled).toBe(true)
    expect(useAgentPanelStore().gateSettled).toBe(true)
    consoleError.mockRestore()
  })

  it('fails closed when the SDK import is blocked', async () => {
    // The hoisted mock registry survives resetModules, so override per-test.
    vi.doMock('posthog-js', () => {
      throw new Error('blocked by ad blocker')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await bootGateExpectingImportFailure()
    vi.doUnmock('posthog-js')

    expect(useAgentPanelStore().enabled).toBe(false)
    expect(useAgentPanelStore().gateSettled).toBe(true)
    expect(consoleError).toHaveBeenCalledWith(
      '[Comfy.AgentPanel] feature-flag gate failed to load',
      expect.any(Error)
    )
    consoleError.mockRestore()
  })
})
