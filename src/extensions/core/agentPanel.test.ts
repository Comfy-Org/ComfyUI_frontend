import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyExtension } from '@/types/comfy'

const capturedExtensions: ComfyExtension[] = []

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: (ext: ComfyExtension) => {
      capturedExtensions.push(ext)
    }
  })
}))

// The extension's only job is the fail-closed flag gate: it flips the panel store's
// `enabled` and closes an open panel when the flag turns off (the tab-bar button and the
// dock both key off the store). Mock the store so both effects are observable.
const agentClose = vi.fn()
const agentStore = { enabled: false, close: agentClose }

vi.mock('@/workbench/extensions/agent/stores/agent/agentPanelStore', () => ({
  useAgentPanelStore: () => agentStore
}))

// The entry awaits `(await import('posthog-js')).default`. Expose isFeatureEnabled (whose
// return the gate reads) and onFeatureFlags (which captures the reload listener so the
// test can drive flag transitions).
let flagEnabled: boolean | undefined
let flagListener: (() => void) | null = null

vi.mock('posthog-js', () => ({
  default: {
    isFeatureEnabled: () => flagEnabled,
    onFeatureFlags: (listener: () => void) => {
      flagListener = listener
      return () => {}
    }
  }
}))

const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

async function loadEntryAndSetup(): Promise<void> {
  await import('./agentPanel')
  const ext = capturedExtensions.find((e) => e.name === 'Comfy.AgentPanel')
  expect(ext).toBeDefined()
  ext!.setup!({} as Parameters<NonNullable<ComfyExtension['setup']>>[0])
  // setup fires setupFlagGate, which awaits the (mocked) posthog-js dynamic import before
  // it captures the onFeatureFlags listener and runs the initial sync(). Flush macrotasks
  // until that listener is registered so tests can drive flag transitions through it.
  for (let i = 0; i < 20 && flagListener === null; i++) await flush()
  expect(flagListener).toBeTypeOf('function')
}

describe('AgentPanel extension flag gate', () => {
  beforeEach(() => {
    capturedExtensions.length = 0
    agentClose.mockClear()
    agentStore.enabled = false
    flagEnabled = undefined
    flagListener = null
    vi.resetModules()
  })

  it('leaves the panel disabled while the flag is undefined', async () => {
    await loadEntryAndSetup()
    expect(agentStore.enabled).toBe(false)
  })

  it('enables the panel when the flag turns true', async () => {
    await loadEntryAndSetup()
    flagEnabled = true
    flagListener!()
    expect(agentStore.enabled).toBe(true)
  })

  it('disables and closes the panel when the flag flips back to false', async () => {
    await loadEntryAndSetup()
    flagEnabled = true
    flagListener!()
    flagEnabled = false
    flagListener!()

    expect(agentStore.enabled).toBe(false)
    expect(agentClose).toHaveBeenCalled()
  })
})
