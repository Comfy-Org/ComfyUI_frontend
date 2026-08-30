import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { ComfyExtension } from '@/types/comfy'

const mocks = vi.hoisted(() => ({
  capturedExtensions: [] as ComfyExtension[],
  agentStore: { enabled: false, isOpen: true, close: vi.fn() },
  canvasStore: { updateSelectedItems: vi.fn() },
  getNodeByLocatorId: vi.fn(),
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

const mockAgentEnabled = ref(false)
vi.mock(
  '@/workbench/extensions/agent/composables/agent/useAgentFeatureGate',
  () => ({ useAgentFeatureGate: () => mockAgentEnabled })
)

async function loadEntryAndSetup(): Promise<void> {
  await import('./agentPanel')
  const ext = mocks.capturedExtensions.find(
    (e) => e.name === 'Comfy.AgentPanel'
  )
  expect(ext).toBeDefined()
  ext!.setup!({} as Parameters<NonNullable<ComfyExtension['setup']>>[0])
  await nextTick()
}

async function loadEnabledExtension(): Promise<ComfyExtension> {
  mockAgentEnabled.value = true
  await loadEntryAndSetup()
  return mocks.capturedExtensions.find(
    (extension) => extension.name === 'Comfy.AgentPanel'
  )!
}

describe('AgentPanel extension flag gate', () => {
  beforeEach(() => {
    mocks.capturedExtensions.length = 0
    mocks.agentStore.close.mockClear()
    mocks.agentStore.enabled = false
    mockAgentEnabled.value = false
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

  it('remains fail-closed in development while the server flag is false', async () => {
    vi.stubEnv('MODE', 'development')

    await loadEntryAndSetup()

    expect(mocks.agentStore.enabled).toBe(false)
  })

  it('leaves the panel disabled while the flag is undefined', async () => {
    await loadEntryAndSetup()
    expect(mocks.agentStore.enabled).toBe(false)
  })

  it('does not register the tab-activity tracker while the flag is off', async () => {
    await loadEntryAndSetup()
    expect(mocks.registerTracker).not.toHaveBeenCalled()
  })

  it('enables the panel when the flag turns true', async () => {
    await loadEntryAndSetup()
    mockAgentEnabled.value = true
    await nextTick()
    expect(mocks.agentStore.enabled).toBe(true)
    expect(mocks.registerTracker).toHaveBeenCalled()
  })

  it('disables the panel without closing it when the flag flips back to false', async () => {
    await loadEntryAndSetup()
    mockAgentEnabled.value = true
    await nextTick()
    mockAgentEnabled.value = false
    await nextTick()

    expect(mocks.agentStore.enabled).toBe(false)
    expect(mocks.agentStore.close).not.toHaveBeenCalled()
    expect(mocks.agentStore.isOpen).toBe(true)
  })

  it('restores each workflow reference after the shared graph load', async () => {
    const extension = await loadEnabledExtension()
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
    const extension = await loadEnabledExtension()
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
    const extension = await loadEnabledExtension()
    mocks.agentStore.isOpen = false
    mocks.nodeSelectionStore.isLoadingWorkflow = true

    extension!.afterLoadGraph!({} as never)

    expect(mocks.nodeSelectionStore.finishWorkflowLoad).toHaveBeenCalledOnce()
    expect(mocks.getNodeByLocatorId).not.toHaveBeenCalled()
    expect(mocks.canvasStore.updateSelectedItems).not.toHaveBeenCalled()
  })
})
