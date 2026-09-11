import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mocked } from 'vitest'

import type { ComfyExtension } from '@/types/comfy'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

let agentStore: Mocked<ReturnType<typeof useAgentPanelStore>>
let canvasStore: Mocked<ReturnType<typeof useCanvasStore>>
let nodeSelectionStore: Mocked<ReturnType<typeof useAgentNodeSelectionStore>>
let workflowStore: ReturnType<typeof useWorkflowStore>

const mocks = vi.hoisted(() => ({
  capturedExtensions: [] as ComfyExtension[],
  notifyAfterGraphConfigure: vi.fn(),
  notifyBeforeGraphLoad: vi.fn(),
  getNodeByLocatorId: vi.fn(),
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

vi.mock('@/workbench/extensions/agent/crdt/mintPortWiring', () => ({
  notifyMintPortsAfterGraphConfigure: mocks.notifyAfterGraphConfigure,
  notifyMintPortsBeforeGraphLoad: mocks.notifyBeforeGraphLoad
}))

vi.mock(import('@/utils/litegraphUtil'), async (importOriginal) => ({
  ...(await importOriginal()),
  isLGraphNode: (node: unknown): node is LGraphNode =>
    typeof node === 'object' && node !== null && 'id' in node
}))

vi.mock(import('@/utils/graphTraversalUtil'), async (importOriginal) => ({
  ...(await importOriginal()),
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
    agentStore = vi.mocked(useAgentPanelStore())
    canvasStore = vi.mocked(useCanvasStore())
    nodeSelectionStore = vi.mocked(useAgentNodeSelectionStore())
    workflowStore = useWorkflowStore()
    canvasStore.updateSelectedItems.mockImplementation(() => {})
    nodeSelectionStore.restoreNodeIds.mockImplementation(() => {})
    mocks.capturedExtensions.length = 0
    mocks.notifyAfterGraphConfigure.mockClear()
    mocks.notifyBeforeGraphLoad.mockClear()
    agentStore.close.mockClear()
    agentStore.enabled = false
    agentStore.isOpen = true
    mocks.flagEnabled = undefined
    mocks.flagListener = null
    mocks.registerTracker.mockClear()
    canvasStore.updateSelectedItems.mockClear()
    mocks.getNodeByLocatorId.mockReset()
    nodeSelectionStore.beginWorkflowLoad.mockClear()
    nodeSelectionStore.finishWorkflowLoad.mockClear()
    nodeSelectionStore.nodeIds.mockReset()
    nodeSelectionStore.nodeIds.mockReturnValue([])
    nodeSelectionStore.restoreNodeIds.mockClear()
    nodeSelectionStore.saveNodeIds.mockClear()
    nodeSelectionStore.isLoadingWorkflow = false
    workflowStore.activeWorkflow = createMockLoadedWorkflow({
      path: 'workflows/first.json'
    })
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

    expect(agentStore.enabled).toBe(true)
  })

  it('leaves the panel disabled while the flag is undefined', async () => {
    await loadEntryAndSetup()
    expect(agentStore.enabled).toBe(false)
  })

  it('registers the tab-activity tracker once at setup, not gated on the flag', async () => {
    await loadEntryAndSetup()
    expect(mocks.registerTracker).toHaveBeenCalledTimes(1)
  })

  it('enables the panel when the flag turns true', async () => {
    await loadEntryAndSetup()
    mocks.flagEnabled = true
    mocks.flagListener!()
    expect(agentStore.enabled).toBe(true)
  })

  it('disables the panel without closing it when the flag flips back to false', async () => {
    await loadEntryAndSetup()
    mocks.flagEnabled = true
    mocks.flagListener!()
    mocks.flagEnabled = false
    mocks.flagListener!()

    expect(agentStore.enabled).toBe(false)
    expect(agentStore.close).not.toHaveBeenCalled()
    expect(agentStore.isOpen).toBe(true)
  })

  it('finishes a pending selection restore when the flag is disabled', async () => {
    await loadEntryAndSetup()
    mocks.flagEnabled = true
    mocks.flagListener!()
    nodeSelectionStore.isLoadingWorkflow = true

    mocks.flagEnabled = false
    mocks.flagListener!()

    expect(nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
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
    agentStore.enabled = true

    extension!.beforeLoadGraph!({} as never)

    expect(mocks.notifyBeforeGraphLoad).toHaveBeenCalledOnce()
    expect(nodeSelectionStore.beginWorkflowLoad).toHaveBeenCalledOnce()

    nodeSelectionStore.isLoadingWorkflow = true
    nodeSelectionStore.nodeIds.mockReturnValue(['12'])
    mocks.getNodeByLocatorId.mockReturnValue(secondNode)
    workflowStore.activeWorkflow = createMockLoadedWorkflow({
      path: 'workflows/second.json'
    })

    extension!.afterLoadGraph!({
      rootGraph,
      canvas: {
        selectItems
      }
    } as never)

    expect(mocks.getNodeByLocatorId).toHaveBeenCalledWith(rootGraph, '12')
    expect(selectItems).toHaveBeenCalledWith([secondNode])
    expect(nodeSelectionStore.restoreNodeIds).toHaveBeenCalledWith(['12'])
    expect(canvasStore.updateSelectedItems).toHaveBeenCalledOnce()
    expect(nodeSelectionStore.finishWorkflowLoad).not.toHaveBeenCalled()
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
    const subgraphNode = {
      id: 'shared',
      graph: { id: '12345678-1234-1234-1234-123456789abc', isRootGraph: false }
    }
    const rootGraph = {}
    const selectItems = vi.fn()

    agentStore.enabled = true
    nodeSelectionStore.isLoadingWorkflow = true
    nodeSelectionStore.nodeIds.mockReturnValue([locator])
    mocks.getNodeByLocatorId.mockReturnValue(subgraphNode)

    extension!.afterLoadGraph!({ rootGraph, canvas: { selectItems } } as never)

    expect(mocks.getNodeByLocatorId).toHaveBeenCalledWith(rootGraph, locator)
    expect(selectItems).toHaveBeenCalledWith([subgraphNode])
    expect(nodeSelectionStore.restoreNodeIds).toHaveBeenCalledWith([locator])
  })

  it('skips graph-load selection tracking while the panel is closed', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    agentStore.isOpen = false

    extension!.beforeLoadGraph!({} as never)

    expect(mocks.notifyBeforeGraphLoad).toHaveBeenCalledOnce()
    expect(nodeSelectionStore.beginWorkflowLoad).not.toHaveBeenCalled()
  })

  it('finishes restoration when the panel closes during graph load', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    agentStore.isOpen = false
    nodeSelectionStore.isLoadingWorkflow = true

    extension!.afterLoadGraph!({} as never)

    expect(nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
    expect(mocks.getNodeByLocatorId).not.toHaveBeenCalled()
    expect(canvasStore.updateSelectedItems).not.toHaveBeenCalled()
  })

  it('finishes restoration when graph configuration fails', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    nodeSelectionStore.isLoadingWorkflow = true

    extension!.onGraphLoadError!(new Error('bad workflow json'), {} as never)

    expect(nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
  })

  it('finishes restoration when selection restoration throws', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    agentStore.enabled = true
    agentStore.isOpen = true
    nodeSelectionStore.isLoadingWorkflow = true
    nodeSelectionStore.nodeIds.mockReturnValue(['12'])
    mocks.getNodeByLocatorId.mockImplementation(() => {
      throw new Error('selection restore failed')
    })

    expect(() =>
      extension!.afterLoadGraph!({ rootGraph: {} } as never)
    ).toThrow('selection restore failed')
    expect(nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
  })

  it('does not start selection restoration while the flag is disabled', async () => {
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )

    extension!.beforeLoadGraph!({} as never)

    expect(nodeSelectionStore.beginWorkflowLoad).not.toHaveBeenCalled()
  })
})
