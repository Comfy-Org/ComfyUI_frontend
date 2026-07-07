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

const registerSidebarTab = vi.fn()
const unregisterSidebarTab = vi.fn()

vi.mock('@/stores/workspace/sidebarTabStore', () => ({
  useSidebarTabStore: () => ({ registerSidebarTab, unregisterSidebarTab })
}))

// Stub the panel component so importing the entry does not pull the whole agent subtree
// (stores, composables, services) into this test. The gate registers it by id/type; the
// component identity is not asserted here.
vi.mock('@/workbench/extensions/agent/AgentPanelRoot.vue', () => ({
  default: { name: 'AgentPanelRootStub', render: () => null }
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
    registerSidebarTab.mockClear()
    unregisterSidebarTab.mockClear()
    flagEnabled = undefined
    flagListener = null
    vi.resetModules()
  })

  it('does not register the tab while the flag is undefined', async () => {
    await loadEntryAndSetup()
    expect(registerSidebarTab).not.toHaveBeenCalled()
  })

  it('registers the agent-panel vue tab once when the flag turns true', async () => {
    await loadEntryAndSetup()
    flagEnabled = true
    flagListener!()

    expect(registerSidebarTab).toHaveBeenCalledTimes(1)
    expect(registerSidebarTab.mock.calls[0][0]).toMatchObject({
      id: 'agent-panel',
      type: 'vue'
    })
  })

  it('unregisters the tab when the flag flips back to false', async () => {
    await loadEntryAndSetup()
    flagEnabled = true
    flagListener!()
    flagEnabled = false
    flagListener!()

    expect(unregisterSidebarTab).toHaveBeenCalledWith('agent-panel')
  })

  it('never double-registers across true/false/true toggling', async () => {
    await loadEntryAndSetup()
    flagEnabled = true
    flagListener!()
    flagEnabled = false
    flagListener!()
    flagEnabled = true
    flagListener!()

    expect(registerSidebarTab).toHaveBeenCalledTimes(2)
    expect(unregisterSidebarTab).toHaveBeenCalledTimes(1)
  })
})
