import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const registered = vi.hoisted(() => ({
  setup: null as (() => Promise<void> | void) | null
}))

const reportErrorMock = vi.hoisted(() => vi.fn())
const agentStore = vi.hoisted(() => ({
  enabled: false,
  gateSettled: false,
  isOpen: false
}))

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: reportErrorMock
}))

// The throwing factory rejects the gate's guarded dynamic import - the
// dependency-chunk failure an ad blocker produces.
vi.mock('@/workbench/extensions/agent/utils/postHogFlagSource', () => {
  throw new Error('flag source chunk failed to load')
})

vi.mock('@/workbench/extensions/agent/stores/agent/agentPanelStore', () => ({
  useAgentPanelStore: () => agentStore
}))

vi.mock('@/workbench/extensions/agent/stores/agent/agentConsentStore', () => ({
  useAgentConsentStore: () => ({ load: vi.fn() })
}))

vi.mock('@/composables/auth/useCurrentUser', async () => {
  const { ref } = await import('vue')
  return {
    useCurrentUser: () => ({
      isLoggedIn: ref(true),
      resolvedUserInfo: ref({ id: 'account-a' })
    })
  }
})

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({ activeWorkflow: null })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ updateSelectedItems: vi.fn() })
}))

vi.mock('@/stores/agentNodeSelectionStore', () => ({
  useAgentNodeSelectionStore: () => ({
    isLoadingWorkflow: false,
    beginWorkflowLoad: vi.fn(),
    finishWorkflowLoad: vi.fn()
  })
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByLocatorId: vi.fn()
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: () => false
}))

vi.mock(
  '@/workbench/extensions/agent/services/agent/workflowTabActivityTracker',
  () => ({ registerWorkflowTabActivityTracker: vi.fn() })
)

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
    agentStore.enabled = false
    agentStore.gateSettled = false
  })

  it('settles fail-closed, reports, and resolves the setup promise', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    vi.resetModules()
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()

    // The gate promise is HANDED BACK to the extension service - a
    // rejection there would be owned by its per-extension catch, so this
    // await doubles as the no-unhandled-rejection pin.
    await registered.setup?.()

    const store = useAgentPanelStore()
    expect(store.gateSettled).toBe(true)
    expect(store.enabled).toBe(false)
    expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'agent_flag_gate_load_failure'
    })
  })
})
