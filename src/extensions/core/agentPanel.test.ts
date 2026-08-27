import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { FLAG_RETRY_INTERVAL_MS, FLAG_RETRY_LIMIT } from './agentPanel'

const FULL_RETRY_BUDGET_MS = FLAG_RETRY_INTERVAL_MS * (FLAG_RETRY_LIMIT + 1)

const posthogState = vi.hoisted(() => ({
  flag: undefined as boolean | undefined,
  /** false = pre-init: the stub fires the callback once and registers nothing. */
  ready: true,
  listeners: [] as Array<
    (
      flags?: string[],
      variants?: Record<string, unknown>,
      context?: { errorsLoading?: boolean }
    ) => void
  >
}))

vi.mock('posthog-js', () => ({
  default: {
    isFeatureEnabled: () =>
      posthogState.ready ? posthogState.flag : undefined,
    onFeatureFlags: (
      listener: (
        flags?: string[],
        variants?: Record<string, unknown>,
        context?: { errorsLoading?: boolean }
      ) => void
    ) => {
      if (!posthogState.ready) {
        // The real SDK's pre-init behavior: invoke synchronously with an
        // error context, register nothing, return a no-op unsubscribe.
        listener([], {}, { errorsLoading: true })
        return () => {}
      }
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
    posthogState.ready = true
    posthogState.listeners = []
    registered.setup = null
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  it('enables the panel when the flag resolves on', async () => {
    posthogState.flag = true
    await bootGate()

    expect(useAgentPanelStore().enabled).toBe(true)
  })

  it('stays disabled when the flag is off (the SDK reports undefined)', async () => {
    // posthog drops false-valued bootstrap flags and reports an absent key
    // as undefined - the off state IS undefined, never false.
    posthogState.flag = undefined
    vi.resetModules()
    await import('./agentPanel')
    registered.setup?.()
    await vi.advanceTimersByTimeAsync(FULL_RETRY_BUDGET_MS)

    expect(useAgentPanelStore().enabled).toBe(false)
    expect(document.body.dataset.agentGateSettled).toBe('true')
  })

  it('propagates a post-boot flag flip into the store', async () => {
    posthogState.flag = true
    await bootGate()
    expect(useAgentPanelStore().enabled).toBe(true)

    posthogState.flag = undefined
    for (const listener of posthogState.listeners) listener()

    expect(useAgentPanelStore().enabled).toBe(false)

    flipFlag(true)
    expect(useAgentPanelStore().enabled).toBe(true)
  })

  it('still hears a flag that arrives after the retry budget is exhausted', async () => {
    posthogState.flag = undefined
    vi.resetModules()
    await import('./agentPanel')
    registered.setup?.()
    await vi.advanceTimersByTimeAsync(FULL_RETRY_BUDGET_MS)
    expect(document.body.dataset.agentGateSettled).toBe('true')
    expect(useAgentPanelStore().enabled).toBe(false)

    flipFlag(true)

    expect(useAgentPanelStore().enabled).toBe(true)
  })

  it('recovers when setup wins the race against posthog initialization', async () => {
    // Pre-init: the SDK stub fires the callback with errorsLoading and
    // registers nothing - that must NOT count as a flags delivery.
    posthogState.ready = false
    vi.resetModules()
    await import('./agentPanel')
    registered.setup?.()
    await Promise.resolve()
    expect(useAgentPanelStore().enabled).toBe(false)

    // Init lands and flags resolve; the bounded retry re-takes the
    // subscription against the live instance.
    posthogState.ready = true
    posthogState.flag = true
    await vi.advanceTimersByTimeAsync(FLAG_RETRY_INTERVAL_MS + 100)

    expect(useAgentPanelStore().enabled).toBe(true)
    expect(document.body.dataset.agentGateSettled).toBe('true')
    expect(posthogState.listeners.length).toBeGreaterThan(0)
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
