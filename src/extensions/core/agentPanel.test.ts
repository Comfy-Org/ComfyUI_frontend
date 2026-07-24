import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyExtension } from '@/types/comfy'

const mocks = vi.hoisted(() => ({
  capturedExtensions: [] as ComfyExtension[],
  agentStore: { enabled: false, isOpen: true, close: vi.fn() },
  flagEnabled: undefined as boolean | undefined,
  flagListener: null as (() => void) | null,
  registerTracker: vi.fn(() => () => {})
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

vi.mock(
  '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker',
  () => ({
    registerWorkflowTabActivityTracker: mocks.registerTracker
  })
)

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
    mocks.registerTracker.mockClear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('forces the panel on in development even while the flag is false', async () => {
    vi.stubEnv('MODE', 'development')
    mocks.flagEnabled = false

    await loadEntryAndSetup()

    expect(mocks.agentStore.enabled).toBe(true)
  })

  it('leaves the panel disabled while the flag is undefined', async () => {
    await loadEntryAndSetup()
    expect(mocks.agentStore.enabled).toBe(false)
  })

  it('registers the tab-activity tracker once at setup, not gated on the flag', async () => {
    await loadEntryAndSetup()
    expect(mocks.registerTracker).toHaveBeenCalledTimes(1)
  })

  it('enables the panel when the flag turns true', async () => {
    await loadEntryAndSetup()
    mocks.flagEnabled = true
    mocks.flagListener!()
    expect(mocks.agentStore.enabled).toBe(true)
  })

  it('disables the panel without closing it when the flag flips back to false', async () => {
    await loadEntryAndSetup()
    mocks.flagEnabled = true
    mocks.flagListener!()
    mocks.flagEnabled = false
    mocks.flagListener!()

    expect(mocks.agentStore.enabled).toBe(false)
    expect(mocks.agentStore.close).not.toHaveBeenCalled()
    expect(mocks.agentStore.isOpen).toBe(true)
  })
})
