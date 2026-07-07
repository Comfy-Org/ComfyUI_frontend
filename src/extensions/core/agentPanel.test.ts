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

// The panel now docks on the right via a visibility store (no sidebar tab). Mock the store so
// the gate's effect on `enabled` and the button's `toggle()` are observable.
const agentToggle = vi.fn()
const agentClose = vi.fn()
const agentStore = {
  enabled: false,
  isOpen: false,
  toggle: agentToggle,
  close: agentClose
}

vi.mock('@/workbench/extensions/agent/stores/agent/agentPanelStore', () => ({
  useAgentPanelStore: () => agentStore
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
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

function capturedAgentExtension(): ComfyExtension {
  const ext = capturedExtensions.find((e) => e.name === 'Comfy.AgentPanel')
  expect(ext).toBeDefined()
  return ext!
}

async function loadEntryAndSetup(): Promise<void> {
  await import('./agentPanel')
  const ext = capturedAgentExtension()
  ext.setup!({} as Parameters<NonNullable<ComfyExtension['setup']>>[0])
  // setup fires setupFlagGate, which awaits the (mocked) posthog-js dynamic import before
  // it captures the onFeatureFlags listener and runs the initial sync(). Flush macrotasks
  // until that listener is registered so tests can drive flag transitions through it.
  for (let i = 0; i < 20 && flagListener === null; i++) await flush()
  expect(flagListener).toBeTypeOf('function')
}

function resetState(): void {
  capturedExtensions.length = 0
  agentToggle.mockClear()
  agentClose.mockClear()
  agentStore.enabled = false
  agentStore.isOpen = false
  flagEnabled = undefined
  flagListener = null
  vi.resetModules()
}

describe('AgentPanel extension flag gate', () => {
  beforeEach(resetState)

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

describe('AgentPanel top-bar button', () => {
  beforeEach(resetState)

  it('exposes no action bar button while the flag is off', async () => {
    await loadEntryAndSetup()
    expect(capturedAgentExtension().actionBarButtons).toEqual([])
  })

  it('exposes the button once the flag is on', async () => {
    await loadEntryAndSetup()
    flagEnabled = true
    flagListener!()

    const [button] = capturedAgentExtension().actionBarButtons ?? []
    expect(button).toBeDefined()
    expect(button.icon).toBe('icon-[comfy--comfy-c]')
    expect(button.label).toBe('agent.askComfyAgent')
  })

  it('toggles the agent panel when the button is clicked', async () => {
    await loadEntryAndSetup()
    flagEnabled = true
    flagListener!()

    const [button] = capturedAgentExtension().actionBarButtons ?? []
    button.onClick?.()
    expect(agentToggle).toHaveBeenCalled()
  })

  it('drops the button when the flag flips back off', async () => {
    await loadEntryAndSetup()
    flagEnabled = true
    flagListener!()
    flagEnabled = false
    flagListener!()

    expect(capturedAgentExtension().actionBarButtons).toEqual([])
  })
})
