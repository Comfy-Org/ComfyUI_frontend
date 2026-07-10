import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyExtension } from '@/types/comfy'

// Per-test mock state, hoisted so the vi.mock factories below may close over it.
// The extension's only job is the fail-closed flag gate: it flips the panel store's
// `enabled` and closes an open panel when the flag turns off (the tab-bar button and the
// dock both key off the store). The posthog mock exposes isFeatureEnabled (whose return
// the gate reads) and onFeatureFlags (which captures the reload listener so the test can
// drive flag transitions).
const mocks = vi.hoisted(() => ({
  capturedExtensions: [] as ComfyExtension[],
  agentStore: { enabled: false, close: vi.fn() },
  flagEnabled: undefined as boolean | undefined,
  flagListener: null as (() => void) | null
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: (ext: ComfyExtension) => {
      mocks.capturedExtensions.push(ext)
    }
  })
}))

vi.mock('@/workbench/extensions/agent/stores/agent/agentPanelStore', () => ({
  useAgentPanelStore: () => mocks.agentStore
}))

vi.mock('posthog-js', () => ({
  default: {
    isFeatureEnabled: () => mocks.flagEnabled,
    onFeatureFlags: (listener: () => void) => {
      mocks.flagListener = listener
      return () => {}
    }
  }
}))

const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

async function loadEntryAndSetup(): Promise<void> {
  await import('./agentPanel')
  const ext = mocks.capturedExtensions.find(
    (e) => e.name === 'Comfy.AgentPanel'
  )
  expect(ext).toBeDefined()
  ext!.setup!({} as Parameters<NonNullable<ComfyExtension['setup']>>[0])
  // setup fires setupFlagGate, which awaits the (mocked) posthog-js dynamic import before
  // it captures the onFeatureFlags listener and runs the initial sync(). Flush macrotasks
  // until that listener is registered so tests can drive flag transitions through it.
  for (let i = 0; i < 20 && mocks.flagListener === null; i++) await flush()
  expect(mocks.flagListener).toBeTypeOf('function')
}

describe('AgentPanel extension flag gate', () => {
  beforeEach(() => {
    mocks.capturedExtensions.length = 0
    mocks.agentStore.close.mockClear()
    mocks.agentStore.enabled = false
    mocks.flagEnabled = undefined
    mocks.flagListener = null
    vi.resetModules()
  })

  it('leaves the panel disabled while the flag is undefined', async () => {
    await loadEntryAndSetup()
    expect(mocks.agentStore.enabled).toBe(false)
  })

  it('enables the panel when the flag turns true', async () => {
    await loadEntryAndSetup()
    mocks.flagEnabled = true
    mocks.flagListener!()
    expect(mocks.agentStore.enabled).toBe(true)
  })

  it('disables and closes the panel when the flag flips back to false', async () => {
    await loadEntryAndSetup()
    mocks.flagEnabled = true
    mocks.flagListener!()
    mocks.flagEnabled = false
    mocks.flagListener!()

    expect(mocks.agentStore.enabled).toBe(false)
    expect(mocks.agentStore.close).toHaveBeenCalledWith('flag_disabled')
  })
})
