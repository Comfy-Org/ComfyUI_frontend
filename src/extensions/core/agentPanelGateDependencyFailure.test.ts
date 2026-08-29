import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const registered = vi.hoisted(() => ({
  setup: null as (() => Promise<void> | void) | null
}))

const reportErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: reportErrorMock
}))

// The throwing factory rejects the gate's guarded dynamic import - the
// dependency-chunk failure an ad blocker produces.
vi.mock('@/workbench/extensions/agent/stores/agentPanelStore', () => {
  throw new Error('agent store chunk failed to load')
})

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: (extension: { setup?: () => Promise<void> | void }) => {
      registered.setup = extension.setup ?? null
    }
  })
}))

describe('the agent panel gate under a dependency-chunk failure', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    reportErrorMock.mockClear()
  })

  it('reports the chunk failure and resolves the setup promise', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    vi.resetModules()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()

    // The gate promise is HANDED BACK to the extension service - a
    // rejection there would be owned by its per-extension catch, so this
    // await doubles as the no-unhandled-rejection pin.
    await registered.setup?.()

    expect(consoleError).toHaveBeenCalledWith(
      '[Comfy.AgentPanel] feature-flag gate failed to load',
      expect.any(Error)
    )
    expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'agent_flag_gate_load_failure'
    })
    consoleError.mockRestore()
  })
})
