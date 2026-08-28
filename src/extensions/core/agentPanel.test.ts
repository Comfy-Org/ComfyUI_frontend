import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyExtension } from '@/types/comfy'

const mocks = vi.hoisted(() => ({
  capturedExtensions: [] as ComfyExtension[],
  notifyAfterGraphConfigure: vi.fn(),
  notifyBeforeGraphLoad: vi.fn(),
  agentStore: {
    enabled: false,
    isOpen: true,
    isVisible: true,
    close: vi.fn()
  },
  canvasStore: { updateSelectedItems: vi.fn() },
  getNodeByLocatorId: vi.fn(),
  flagEnabled: undefined as boolean | undefined,
  flagListener: null as (() => void) | null,
  nodeSelectionStore: {
    beginWorkflowLoad: vi.fn(),
    finishWorkflowLoad: vi.fn(),
    isLoadingWorkflow: false,
    nodeIds: vi.fn(() => [] as string[]),
    restoreNodeIds: vi.fn(),
    saveNodeIds: vi.fn()
  },
  registerTracker: vi.fn(() => () => {}),
  workflowStore: {
    activeWorkflow: { path: 'workflows/first.json' },
    nodeToNodeLocatorId: vi.fn((node: { locatorId?: string; id: number }) =>
      node.locatorId ? node.locatorId : String(node.id)
    )
  }
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: (ext: ComfyExtension) => {
      mocks.capturedExtensions.push(ext)
    }
  })
}))

vi.mock('@/workbench/extensions/agent/crdt/mintPortWiring', () => ({
  notifyMintPortsAfterGraphConfigure: mocks.notifyAfterGraphConfigure,
  notifyMintPortsBeforeGraphLoad: mocks.notifyBeforeGraphLoad
}))

vi.mock('@/workbench/extensions/agent/stores/agent/agentPanelStore', () => ({
  useAgentPanelStore: () => mocks.agentStore
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => mocks.workflowStore
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => mocks.canvasStore
}))

vi.mock('@/stores/agentNodeSelectionStore', () => ({
  useAgentNodeSelectionStore: () => mocks.nodeSelectionStore
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: (node: unknown): node is { id: number } =>
    typeof node === 'object' && node !== null && 'id' in node
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByLocatorId: mocks.getNodeByLocatorId
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
  const { registerAgentPanelExtension } = await import('./agentPanel')
  registerAgentPanelExtension()
  const ext = mocks.capturedExtensions.find(
    (e) => e.name === 'Comfy.AgentPanel'
  )
  expect(ext).toBeDefined()
  ext!.setup!({} as Parameters<NonNullable<ComfyExtension['setup']>>[0])
  for (let i = 0; i < 2000 && mocks.flagListener === null; i++) await flush()
  expect(mocks.flagListener).toBeTypeOf('function')
}

describe('AgentPanel extension flag gate', () => {
  beforeEach(() => {
    mocks.capturedExtensions.length = 0
    mocks.notifyAfterGraphConfigure.mockClear()
    mocks.notifyBeforeGraphLoad.mockClear()
    mocks.agentStore.close.mockClear()
    mocks.agentStore.enabled = false
    mocks.agentStore.isOpen = true
    mocks.agentStore.isVisible = true
    mocks.flagEnabled = undefined
    mocks.flagListener = null
    mocks.registerTracker.mockClear()
    mocks.canvasStore.updateSelectedItems.mockClear()
    mocks.getNodeByLocatorId.mockReset()
    mocks.nodeSelectionStore.beginWorkflowLoad.mockClear()
    mocks.nodeSelectionStore.finishWorkflowLoad.mockClear()
    mocks.nodeSelectionStore.nodeIds.mockReset()
    mocks.nodeSelectionStore.nodeIds.mockReturnValue([])
    mocks.nodeSelectionStore.restoreNodeIds.mockClear()
    mocks.nodeSelectionStore.saveNodeIds.mockClear()
    mocks.nodeSelectionStore.isLoadingWorkflow = false
    mocks.workflowStore.activeWorkflow = { path: 'workflows/first.json' }
    vi.resetModules()
  })

  it('does not self-register when its module is imported', async () => {
    await import('./agentPanel')

    expect(mocks.capturedExtensions).toEqual([])
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

  it('finishes a pending selection restore when the flag is disabled', async () => {
    await loadEntryAndSetup()
    mocks.flagEnabled = true
    mocks.flagListener!()
    mocks.nodeSelectionStore.isLoadingWorkflow = true

    mocks.flagEnabled = false
    mocks.flagListener!()

    expect(mocks.nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
  })

  it('restores each workflow reference after the shared graph load', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    const secondNode = { id: 12 }
    const rootGraph = {}
    const selectItems = vi.fn()
    mocks.agentStore.enabled = true

    extension!.beforeLoadGraph!({} as never)

    expect(mocks.notifyBeforeGraphLoad).toHaveBeenCalledOnce()
    expect(mocks.nodeSelectionStore.beginWorkflowLoad).toHaveBeenCalledOnce()

    mocks.nodeSelectionStore.isLoadingWorkflow = true
    mocks.nodeSelectionStore.nodeIds.mockReturnValue(['12'])
    mocks.getNodeByLocatorId.mockReturnValue(secondNode)
    mocks.workflowStore.activeWorkflow = { path: 'workflows/second.json' }

    extension!.afterLoadGraph!({
      rootGraph,
      canvas: {
        selectItems
      }
    } as never)

    expect(mocks.getNodeByLocatorId).toHaveBeenCalledWith(rootGraph, '12')
    expect(selectItems).toHaveBeenCalledWith([secondNode])
    expect(mocks.nodeSelectionStore.restoreNodeIds).toHaveBeenCalledWith(['12'])
    expect(mocks.canvasStore.updateSelectedItems).toHaveBeenCalledOnce()
    expect(mocks.nodeSelectionStore.finishWorkflowLoad).not.toHaveBeenCalled()
  })

  it('closes the mint suppression bracket after graph configuration', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )

    extension!.afterConfigureGraph!([], {} as never)

    expect(mocks.notifyAfterGraphConfigure).toHaveBeenCalledOnce()
  })

  it('restores a subgraph reference by its locator after graph load', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    const locator = '12345678-1234-1234-1234-123456789abc:shared'
    const subgraphNode = { id: 'shared', locatorId: locator }
    const rootGraph = {}
    const selectItems = vi.fn()

    mocks.agentStore.enabled = true
    mocks.nodeSelectionStore.isLoadingWorkflow = true
    mocks.nodeSelectionStore.nodeIds.mockReturnValue([locator])
    mocks.getNodeByLocatorId.mockReturnValue(subgraphNode)

    extension!.afterLoadGraph!({ rootGraph, canvas: { selectItems } } as never)

    expect(mocks.getNodeByLocatorId).toHaveBeenCalledWith(rootGraph, locator)
    expect(selectItems).toHaveBeenCalledWith([subgraphNode])
    expect(mocks.nodeSelectionStore.restoreNodeIds).toHaveBeenCalledWith([
      locator
    ])
  })

  it('skips graph-load selection tracking while the panel is closed', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    mocks.agentStore.isOpen = false

    extension!.beforeLoadGraph!({} as never)

    expect(mocks.notifyBeforeGraphLoad).toHaveBeenCalledOnce()
    expect(mocks.nodeSelectionStore.beginWorkflowLoad).not.toHaveBeenCalled()
  })

  it('finishes restoration when the panel closes during graph load', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    mocks.agentStore.isVisible = false
    mocks.nodeSelectionStore.isLoadingWorkflow = true

    extension!.afterLoadGraph!({} as never)

    expect(mocks.nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
    expect(mocks.getNodeByLocatorId).not.toHaveBeenCalled()
    expect(mocks.canvasStore.updateSelectedItems).not.toHaveBeenCalled()
  })

  it('finishes restoration when graph configuration fails', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    mocks.nodeSelectionStore.isLoadingWorkflow = true

    extension!.onGraphLoadError!(new Error('bad workflow json'), {} as never)

    expect(mocks.nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
  })

  it('finishes restoration when selection restoration throws', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    mocks.agentStore.enabled = true
    mocks.agentStore.isOpen = true
    mocks.nodeSelectionStore.isLoadingWorkflow = true
    mocks.nodeSelectionStore.nodeIds.mockReturnValue(['12'])
    mocks.getNodeByLocatorId.mockImplementation(() => {
      throw new Error('selection restore failed')
    })

    expect(() =>
      extension!.afterLoadGraph!({ rootGraph: {} } as never)
    ).toThrow('selection restore failed')
    expect(mocks.nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
  })

  it('does not start selection restoration while the flag is disabled', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )

    extension!.beforeLoadGraph!({} as never)

    expect(mocks.nodeSelectionStore.beginWorkflowLoad).not.toHaveBeenCalled()
  })
})
