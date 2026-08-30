import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyExtension } from '@/types/comfy'
import type { Ref } from 'vue'

const mocks = vi.hoisted(() => ({
  capturedExtensions: [] as ComfyExtension[],
  agentStore: { enabled: false, isOpen: true, close: vi.fn() },
  canvasStore: { updateSelectedItems: vi.fn() },
  getNodeByLocatorId: vi.fn(),
  flagEnabled: null as Ref<boolean | undefined> | null,
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

vi.mock('@/composables/useFeatureFlags', async () => {
  const { ref } = await import('vue')
  mocks.flagEnabled = ref<boolean | undefined>(false)
  return {
    ServerFeatureFlag: {
      AGENT_IN_APP_EXPERIENCE: 'agent-in-app-experience'
    },
    useFeatureFlags: () => ({
      featureFlag: () => mocks.flagEnabled
    })
  }
})

async function loadEntryAndSetup(): Promise<void> {
  await import('./agentPanel')
  const ext = mocks.capturedExtensions.find(
    (e) => e.name === 'Comfy.AgentPanel'
  )
  expect(ext).toBeDefined()
  ext!.setup!({} as Parameters<NonNullable<ComfyExtension['setup']>>[0])
}

describe('AgentPanel extension flag gate', () => {
  beforeEach(() => {
    mocks.capturedExtensions.length = 0
    mocks.agentStore.close.mockClear()
    mocks.agentStore.enabled = false
    if (mocks.flagEnabled) mocks.flagEnabled.value = undefined
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

  it('forces the panel on in development even while the flag is false', async () => {
    vi.stubEnv('MODE', 'development')

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
    mocks.flagEnabled!.value = true
    await vi.waitFor(() => expect(mocks.agentStore.enabled).toBe(true))
    expect(mocks.agentStore.enabled).toBe(true)
  })

  it('disables the panel without closing it when the flag flips back to false', async () => {
    await loadEntryAndSetup()
    mocks.flagEnabled!.value = true
    await vi.waitFor(() => expect(mocks.agentStore.enabled).toBe(true))
    mocks.flagEnabled!.value = false
    await vi.waitFor(() => expect(mocks.agentStore.enabled).toBe(false))

    expect(mocks.agentStore.enabled).toBe(false)
    expect(mocks.agentStore.close).not.toHaveBeenCalled()
    expect(mocks.agentStore.isOpen).toBe(true)
  })

  it('restores each workflow reference after the shared graph load', async () => {
    await import('./agentPanel')
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    const secondNode = { id: 12 }
    const rootGraph = {}
    const selectItems = vi.fn()

    extension!.beforeLoadGraph!({} as never)

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

  it('restores a subgraph reference by its locator after graph load', async () => {
    await import('./agentPanel')
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    const locator = '12345678-1234-1234-1234-123456789abc:shared'
    const subgraphNode = { id: 'shared', locatorId: locator }
    const rootGraph = {}
    const selectItems = vi.fn()

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

  it('finishes restoration when the panel closes during graph load', async () => {
    await import('./agentPanel')
    const extension = mocks.capturedExtensions.find(
      (item) => item.name === 'Comfy.AgentPanel'
    )
    mocks.agentStore.isOpen = false
    mocks.nodeSelectionStore.isLoadingWorkflow = true

    extension!.afterLoadGraph!({} as never)

    expect(mocks.nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
    expect(mocks.getNodeByLocatorId).not.toHaveBeenCalled()
    expect(mocks.canvasStore.updateSelectedItems).not.toHaveBeenCalled()
  })
})
