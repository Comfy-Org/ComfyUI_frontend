import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyExtension } from '@/types/comfy'

const mocks = vi.hoisted(() => ({
  capturedExtensions: [] as ComfyExtension[],
  agentStore: { enabled: false, isOpen: true, close: vi.fn() },
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
