import { fromPartial } from '@total-typescript/shoehorn'
vi.mock(import('firebase/auth'))
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyApp } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'
import type { useExtensionService } from '@/services/extensionService'
import { registerAgentPanelExtension } from './agentPanel'

const registered = vi.hoisted<{
  setup: ComfyExtension['setup'] | null
}>(() => ({ setup: null }))

const reportErrorMock = vi.hoisted(() => vi.fn())

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: reportErrorMock
}))

// The throwing factory rejects the gate's guarded dynamic import - the
// dependency-chunk failure an ad blocker produces.
vi.mock(import('@/workbench/extensions/agent/utils/postHogFlagSource'), () => {
  throw new Error('flag source chunk failed to load')
})

vi.mock(import('@/utils/graphTraversalUtil'), () => ({
  getNodeByLocatorId: vi.fn()
}))

vi.mock(import('@/utils/litegraphUtil'), () => ({
  isLGraphNode: (_item: unknown): _item is LGraphNode => false
}))

vi.mock(
  import('@/workbench/extensions/agent/services/agent/workflowTabActivityTracker'),
  () => ({ registerWorkflowTabActivityTracker: vi.fn() })
)

vi.mock(import('@/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial<ReturnType<typeof useExtensionService>>({
      registerExtension: (extension: ComfyExtension) => {
        registered.setup = extension.setup ?? null
      }
    })
}))

describe('the agent panel gate under a dependency-chunk failure', () => {
  beforeEach(() => {
    reportErrorMock.mockClear()
    useAgentPanelStore().enabled = false
    useAgentPanelStore().gateSettled = false
  })

  it('settles fail-closed, reports, and resolves the setup promise', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    registerAgentPanelExtension()

    // The gate promise is HANDED BACK to the extension service - a
    // rejection there would be owned by its per-extension catch, so this
    // await doubles as the no-unhandled-rejection pin.
    await registered.setup?.(fromPartial<ComfyApp>({}))

    const store = useAgentPanelStore()
    expect(store.gateSettled).toBe(true)
    expect(store.enabled).toBe(false)
    expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'agent_flag_gate_load_failure'
    })
    expect(consoleError).not.toHaveBeenCalled()
  })
})
