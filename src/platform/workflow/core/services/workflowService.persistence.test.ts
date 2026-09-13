import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { ComfyWorkflow as ComfyWorkflowClass } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { createMockChangeTracker } from '@/utils/__tests__/litegraphTestUtils'

const draftStoreMocks = vi.hoisted(() => ({
  saveDraft: vi.fn((_path: string, _data: string, _meta: unknown) => true),
  getDraft: vi.fn(),
  removeDraft: vi.fn(),
  markDraftUsed: vi.fn(),
  isPersistencePaused: vi.fn(() => false),
  shouldNotifySaveFailure: vi.fn(() => true),
  markSaveSucceeded: vi.fn()
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    prompt: vi.fn(),
    confirm: vi.fn()
  })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: { ds: { offset: [0, 0], scale: 1 } },
    rootGraph: { serialize: vi.fn(() => ({})), extra: {} },
    loadGraphData: vi.fn(),
    nodeOutputs: {},
    nodePreviewImages: {}
  }
}))

vi.mock('@/scripts/defaultGraph', () => ({
  defaultGraph: {},
  blankGraph: {}
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ linearMode: false })
}))

vi.mock('@/renderer/core/thumbnail/useWorkflowThumbnail', () => ({
  useWorkflowThumbnail: () => ({
    storeThumbnail: vi.fn(),
    getThumbnail: vi.fn()
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackDefaultViewSet: vi.fn(),
    trackWorkflowSaved: vi.fn(),
    trackEnterLinear: vi.fn()
  })
}))

vi.mock('@/platform/workflow/persistence/stores/workflowDraftStoreV2', () => ({
  useWorkflowDraftStoreV2: () => draftStoreMocks
}))

vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({ clear: vi.fn() })
}))

vi.mock('@/stores/subgraphNavigationStore', () => ({
  useSubgraphNavigationStore: () => ({ saveCurrentViewport: vi.fn() })
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    get workflow() {
      return useWorkflowStore()
    }
  })
}))

function createLoadedWorkflow(): LoadedComfyWorkflow {
  const workflow = new ComfyWorkflowClass({
    path: 'workflows/persistence.json',
    modified: Date.now(),
    size: 100
  })
  workflow.changeTracker = createMockChangeTracker()
  workflow.content = '{}'
  workflow.originalContent = '{}'
  return workflow as LoadedComfyWorkflow
}

describe('workflow service persistence reconciliation', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia())
    draftStoreMocks.saveDraft.mockReturnValue(true)
    draftStoreMocks.isPersistencePaused.mockReturnValue(false)
    draftStoreMocks.shouldNotifySaveFailure.mockReturnValue(true)
    vi.spyOn(useSettingStore(), 'get').mockImplementation((key: string) => {
      return key === 'Comfy.Workflow.Persist'
    })
  })

  it('does not persist the outgoing workflow while persistence is paused', () => {
    const workflowStore = useWorkflowStore()
    workflowStore.activeWorkflow = createLoadedWorkflow()
    draftStoreMocks.isPersistencePaused.mockReturnValue(true)

    useWorkflowService().beforeLoadNewGraph()

    expect(draftStoreMocks.saveDraft).not.toHaveBeenCalled()
  })

  it('persists the known dirty bit and marks a successful save', () => {
    const workflowStore = useWorkflowStore()
    const workflow = createLoadedWorkflow()
    workflow.isModified = true
    workflowStore.activeWorkflow = workflow

    useWorkflowService().beforeLoadNewGraph()

    expect(draftStoreMocks.saveDraft).toHaveBeenCalledWith(
      workflow.path,
      JSON.stringify(workflow.activeState),
      {
        name: workflow.key,
        isTemporary: workflow.isTemporary,
        isModified: true
      }
    )
    expect(draftStoreMocks.markSaveSucceeded).toHaveBeenCalledOnce()
  })

  it('persists canvas view state when view restore is enabled', () => {
    vi.spyOn(useSettingStore(), 'get').mockImplementation((key: string) => {
      return (
        key === 'Comfy.Workflow.Persist' ||
        key === 'Comfy.EnableWorkflowViewRestore'
      )
    })
    const workflowStore = useWorkflowStore()
    const workflow = createLoadedWorkflow()
    workflow.changeTracker.ds = { scale: 0.5, offset: [10, -20] }
    workflowStore.activeWorkflow = workflow

    useWorkflowService().beforeLoadNewGraph()

    const [, payload] = draftStoreMocks.saveDraft.mock.calls[0]
    expect(JSON.parse(payload).extra.ds).toEqual({
      scale: 0.5,
      offset: [10, -20]
    })
  })

  it('deduplicates repeated failures through the shared failure episode', () => {
    const workflowStore = useWorkflowStore()
    workflowStore.activeWorkflow = createLoadedWorkflow()
    const addToastSpy = vi.spyOn(useToastStore(), 'add')
    draftStoreMocks.saveDraft.mockReturnValue(false)
    draftStoreMocks.shouldNotifySaveFailure
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)

    const service = useWorkflowService()
    service.beforeLoadNewGraph()
    service.beforeLoadNewGraph()

    expect(draftStoreMocks.shouldNotifySaveFailure).toHaveBeenCalledTimes(2)
    expect(addToastSpy).toHaveBeenCalledTimes(1)
  })

  it('notifies once and logs when the draft store throws', () => {
    const workflowStore = useWorkflowStore()
    workflowStore.activeWorkflow = createLoadedWorkflow()
    const addToastSpy = vi.spyOn(useToastStore(), 'add')
    const error = new Error('quota')
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    draftStoreMocks.saveDraft.mockImplementationOnce(() => {
      throw error
    })

    useWorkflowService().beforeLoadNewGraph()

    expect(addToastSpy).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to persist active workflow draft',
      error
    )
    expect(draftStoreMocks.markSaveSucceeded).not.toHaveBeenCalled()
  })
})
