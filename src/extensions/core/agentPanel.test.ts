import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { FLAG_SETTLE_TIMEOUT_MS } from '@/workbench/extensions/agent/utils/postHogFlagSource'

const posthogState = vi.hoisted(() => ({
  flag: undefined as boolean | undefined,
  listeners: [] as Array<
    (
      flags?: string[],
      variants?: Record<string, unknown>,
      context?: { errorsLoading?: boolean }
    ) => void
  >
}))

// Probe-verified posthog contract: featureFlags exists from the
// constructor; an off or absent flag reads as undefined.
vi.mock('posthog-js', () => ({
  default: {
    isFeatureEnabled: () => posthogState.flag,
    onFeatureFlags: (
      listener: (
        flags?: string[],
        variants?: Record<string, unknown>,
        context?: { errorsLoading?: boolean }
      ) => void
    ) => {
      posthogState.listeners.push(listener)
      return () => {
        posthogState.listeners = posthogState.listeners.filter(
          (registered) => registered !== listener
        )
      }
    }
  }
}))

const registered = vi.hoisted(() => ({
  setup: null as (() => void) | null,
  extension: null as {
    beforeLoadGraph?: () => Promise<void>
    afterLoadGraph?: (app: unknown) => Promise<void>
  } | null
}))

const hookMocks = vi.hoisted(() => ({
  nodeSelectionStore: {
    isLoadingWorkflow: false,
    beginWorkflowLoad: vi.fn(),
    finishWorkflowLoad: vi.fn(),
    nodeIds: vi.fn((): string[] => []),
    restoreNodeIds: vi.fn()
  },
  workflowStore: {
    activeWorkflow: null as { path: string } | null,
    nodeToNodeLocatorId: vi.fn((node: { id: unknown }) => String(node.id))
  },
  canvasStore: { updateSelectedItems: vi.fn() },
  getNodeByLocatorId: vi.fn()
}))

vi.mock('@/stores/agentNodeSelectionStore', () => ({
  useAgentNodeSelectionStore: () => hookMocks.nodeSelectionStore
}))
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => hookMocks.workflowStore
}))
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => hookMocks.canvasStore
}))
vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByLocatorId: hookMocks.getNodeByLocatorId
}))
vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: (node: unknown) => node != null
}))

const reportErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: reportErrorMock
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: (extension: { setup?: () => void }) => {
      registered.setup = extension.setup ?? null
      registered.extension = extension as typeof registered.extension
    }
  })
}))

async function bootGate(): Promise<void> {
  vi.stubGlobal('__DISTRIBUTION__', 'cloud')
  vi.resetModules()
  const { registerAgentPanelExtension } = await import('./agentPanel')
  registerAgentPanelExtension()
  registered.setup?.()
  // The mocked dynamic import outlives a bare microtask - wait for the subscription.
  await vi.waitFor(() => {
    if (posthogState.listeners.length === 0) {
      throw new Error('gate not subscribed yet')
    }
  })
}

async function bootGateExpectingImportFailure(): Promise<void> {
  vi.stubGlobal('__DISTRIBUTION__', 'cloud')
  vi.resetModules()
  const { registerAgentPanelExtension } = await import('./agentPanel')
  registerAgentPanelExtension()
  registered.setup?.()
  await vi.waitFor(() => {
    if (!useAgentPanelStore().gateSettled) {
      throw new Error('gate not settled yet')
    }
  })
}

function deliverFlags(value: boolean | undefined): void {
  posthogState.flag = value
  for (const listener of posthogState.listeners) listener()
}

describe('the agent panel flag gate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    posthogState.flag = undefined
    posthogState.listeners = []
    registered.setup = null
    reportErrorMock.mockClear()
  })

  it('registers its subscription pre-init and enables on the flags delivery', async () => {
    await bootGate()
    expect(posthogState.listeners.length).toBeGreaterThan(0)
    expect(useAgentPanelStore().enabled).toBe(false)
    expect(useAgentPanelStore().gateSettled).toBe(false)

    deliverFlags(true)

    expect(useAgentPanelStore().enabled).toBe(true)
    expect(useAgentPanelStore().gateSettled).toBe(true)
  })

  it('stays disabled and settles on the delivery when the flag is off', async () => {
    await bootGate()

    // The off state IS undefined, never false; delivery still settles the gate.
    deliverFlags(undefined)

    expect(useAgentPanelStore().enabled).toBe(false)
    expect(useAgentPanelStore().gateSettled).toBe(true)
  })

  it('settles fail-closed by timeout when no delivery ever arrives', async () => {
    // Fake timers go in BEFORE boot so the settle timeout is fake-scheduled.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    vi.resetModules()
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    registered.setup?.()
    for (let i = 0; i < 200 && posthogState.listeners.length === 0; i++) {
      await vi.advanceTimersByTimeAsync(1)
    }
    expect(posthogState.listeners.length).toBeGreaterThan(0)
    expect(useAgentPanelStore().gateSettled).toBe(false)

    await vi.advanceTimersByTimeAsync(FLAG_SETTLE_TIMEOUT_MS + 100)

    expect(useAgentPanelStore().enabled).toBe(false)
    expect(useAgentPanelStore().gateSettled).toBe(true)
  })

  it('ignores a stale persisted flag until the first delivery', async () => {
    // posthog persists flags in localStorage: isFeatureEnabled() answers
    // true from the cache before any fresh delivery. The gate must not
    // mount (or fetch chunks) on that stale answer.
    posthogState.flag = true
    await bootGate()

    const store = useAgentPanelStore()
    expect(store.enabled).toBe(false)
    expect(store.gateSettled).toBe(false)

    deliverFlags(true)
    expect(store.enabled).toBe(true)
    expect(store.gateSettled).toBe(true)
  })

  it('propagates a post-boot flag flip into the store', async () => {
    await bootGate()
    deliverFlags(true)
    expect(useAgentPanelStore().enabled).toBe(true)

    deliverFlags(undefined)
    expect(useAgentPanelStore().enabled).toBe(false)

    deliverFlags(true)
    expect(useAgentPanelStore().enabled).toBe(true)
  })

  it('force-enables dev builds before any posthog work, even a blocked import', async () => {
    vi.stubEnv('MODE', 'development')
    vi.doMock('posthog-js', () => {
      throw new Error('blocked by ad blocker')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await bootGateExpectingImportFailure()
    vi.doUnmock('posthog-js')
    vi.unstubAllEnvs()

    expect(useAgentPanelStore().enabled).toBe(true)
    expect(useAgentPanelStore().gateSettled).toBe(true)
    // Dev force-enable is a product decision: the failure still reaches the sinks.
    expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'agent_flag_gate_load_failure'
    })
    consoleError.mockRestore()
  })

  it('fails closed when the SDK import is blocked', async () => {
    // The hoisted mock registry survives resetModules, so override per-test.
    vi.doMock('posthog-js', () => {
      throw new Error('blocked by ad blocker')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await bootGateExpectingImportFailure()
    vi.doUnmock('posthog-js')

    expect(useAgentPanelStore().enabled).toBe(false)
    expect(useAgentPanelStore().gateSettled).toBe(true)
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

// Seam receipt: the selection-persistence hooks reach the panel store through
// the same dynamic-import boundary as the rest of the shell, and still fire.
describe('selection persistence across workflow loads', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    hookMocks.nodeSelectionStore.isLoadingWorkflow = false
    hookMocks.workflowStore.activeWorkflow = null
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    vi.resetModules()
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    useAgentPanelStore().isOpen = true
  })

  it('restores each workflow reference after the shared graph load', async () => {
    const secondNode = { id: 12 }
    const rootGraph = {}
    const selectItems = vi.fn()

    await registered.extension!.beforeLoadGraph!()
    expect(
      hookMocks.nodeSelectionStore.beginWorkflowLoad
    ).toHaveBeenCalledOnce()

    hookMocks.nodeSelectionStore.isLoadingWorkflow = true
    hookMocks.nodeSelectionStore.nodeIds.mockReturnValue(['12'])
    hookMocks.getNodeByLocatorId.mockReturnValue(secondNode)
    hookMocks.workflowStore.activeWorkflow = { path: 'workflows/second.json' }

    await registered.extension!.afterLoadGraph!({
      rootGraph,
      canvas: { selectItems }
    })

    expect(hookMocks.getNodeByLocatorId).toHaveBeenCalledWith(rootGraph, '12')
    expect(hookMocks.nodeSelectionStore.nodeIds).toHaveBeenCalledWith(
      'workflows/second.json'
    )
    expect(selectItems).toHaveBeenCalledWith([secondNode])
    expect(hookMocks.nodeSelectionStore.restoreNodeIds).toHaveBeenCalledWith([
      '12'
    ])
    expect(hookMocks.canvasStore.updateSelectedItems).toHaveBeenCalledOnce()
    expect(
      hookMocks.nodeSelectionStore.finishWorkflowLoad
    ).not.toHaveBeenCalled()
  })

  it('skips the whole flow while the panel is closed', async () => {
    useAgentPanelStore().isOpen = false

    await registered.extension!.beforeLoadGraph!()

    expect(
      hookMocks.nodeSelectionStore.beginWorkflowLoad
    ).not.toHaveBeenCalled()
  })

  it('finishes restoration when the panel closes during graph load', async () => {
    useAgentPanelStore().isOpen = false
    hookMocks.nodeSelectionStore.isLoadingWorkflow = true

    await registered.extension!.afterLoadGraph!({})

    expect(
      hookMocks.nodeSelectionStore.finishWorkflowLoad
    ).toHaveBeenCalledOnce()
    expect(hookMocks.getNodeByLocatorId).not.toHaveBeenCalled()
    expect(hookMocks.canvasStore.updateSelectedItems).not.toHaveBeenCalled()
  })
})
