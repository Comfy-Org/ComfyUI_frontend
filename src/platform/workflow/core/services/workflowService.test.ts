import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  LoadedComfyWorkflow,
  PendingWarnings
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { ComfyWorkflow as ComfyWorkflowClass } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useSettingStore } from '@/platform/settings/settingStore'
import { defaultGraph } from '@/scripts/defaultGraph'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import {
  resetWorkflowLoadQueueForTests,
  useWorkflowService
} from '@/platform/workflow/core/services/workflowService'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { app } from '@/scripts/app'
import { useAppMode } from '@/composables/useAppMode'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { createMockChangeTracker } from '@/utils/__tests__/litegraphTestUtils'
import type { AppMode } from '@/utils/appMode'
import { isValidUuid } from '@/utils/formatUtil'
import { t } from '@/i18n'

function createModeTestWorkflow(
  options: {
    path?: string
    initialMode?: AppMode | null
    activeMode?: AppMode | null
    loaded?: boolean
  } = {}
): LoadedComfyWorkflow {
  const workflow = new ComfyWorkflowClass({
    path: options.path ?? 'workflows/test.json',
    modified: Date.now(),
    size: 100
  })
  if ('initialMode' in options) workflow.initialMode = options.initialMode
  workflow.activeMode = options.activeMode ?? null
  if (options.loaded !== false) {
    workflow.changeTracker = createMockChangeTracker()
    workflow.content = '{}'
    workflow.originalContent = '{}'
  }
  return workflow as LoadedComfyWorkflow
}

function makeWorkflowData(
  extra: Record<string, unknown> = {}
): ComfyWorkflowJSON {
  return {
    last_node_id: 5,
    last_link_id: 3,
    nodes: [],
    links: [],
    groups: [],
    config: {},
    version: 0.4,
    extra
  }
}

function makeWorkflowDataWithId(id: string): ComfyWorkflowJSON {
  return { ...makeWorkflowData(), id }
}

const { mockConfirm, mockTrackWorkflowSaved } = vi.hoisted(() => ({
  mockConfirm: vi.fn(),
  mockTrackWorkflowSaved: vi.fn()
}))

const draftStoreMocks = vi.hoisted(() => ({
  saveDraft: vi.fn(() => true),
  getDraft: vi.fn(),
  removeDraft: vi.fn(),
  markDraftUsed: vi.fn()
}))

const subgraphNavigationMocks = vi.hoisted(() => ({
  navigationIntentId: 0,
  beginWorkflowNavigation: vi.fn(
    () => ++subgraphNavigationMocks.navigationIntentId
  ),
  endWorkflowNavigation: vi.fn(),
  saveCurrentViewport: vi.fn()
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    prompt: vi.fn(),
    confirm: mockConfirm
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

const reportErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: reportErrorMock
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackDefaultViewSet: vi.fn(),
    trackWorkflowSaved: mockTrackWorkflowSaved,
    trackEnterLinear: vi.fn()
  })
}))

vi.mock('@/platform/workflow/persistence/stores/workflowDraftStoreV2', () => ({
  useWorkflowDraftStoreV2: () => draftStoreMocks
}))

vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({
    clear: vi.fn()
  })
}))

vi.mock('@/stores/subgraphNavigationStore', () => ({
  useSubgraphNavigationStore: () => subgraphNavigationMocks
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    get workflow() {
      return useWorkflowStore()
    }
  })
}))

function createWorkflow(
  warnings: PendingWarnings | null = null,
  options: { loadable?: boolean; path?: string } = {}
): ComfyWorkflow {
  const wf = {
    pendingWarnings: warnings,
    ...(options.loadable && {
      path: options.path ?? 'workflows/test.json',
      isLoaded: true,
      activeState: { nodes: [], links: [] },
      changeTracker: { reset: vi.fn(), restore: vi.fn() }
    })
  } as Partial<ComfyWorkflow>
  return wf as ComfyWorkflow
}

function enableWarningSettings() {
  vi.spyOn(useSettingStore(), 'get').mockImplementation(
    (key: string): boolean => {
      if (key === 'Comfy.Workflow.ShowMissingModelsWarning') return true
      return false
    }
  )
}

describe('useWorkflowService', () => {
  beforeEach(() => {
    vi.mocked(app.loadGraphData).mockResolvedValue(true)
    resetWorkflowLoadQueueForTests()
    draftStoreMocks.saveDraft.mockReturnValue(true)
    subgraphNavigationMocks.navigationIntentId = 0
  })

  afterEach(() => {
    // A leak here means a test left a load pending or a close unbalanced -
    // fail at the origin instead of as a timeout three tests later.
    const drained = resetWorkflowLoadQueueForTests()
    expect(drained).toEqual({
      pendingLoads: 0,
      closingCount: 0,
      pendingPaths: 0
    })
  })

  describe('showPendingWarnings', () => {
    beforeEach(() => {
      enableWarningSettings()
    })

    it('should clear missing nodes when workflow has no pending warnings', () => {
      const workflow = createWorkflow(null)
      useWorkflowService().showPendingWarnings(workflow)

      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledWith([])
    })

    it('should surface missing nodes and cache warnings', () => {
      const missingNodeTypes = ['CustomNode1', 'CustomNode2']
      const workflow = createWorkflow({ missingNodeTypes })

      useWorkflowService().showPendingWarnings(workflow)

      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledWith(missingNodeTypes)
      expect(workflow.pendingWarnings).toEqual({
        missingNodeTypes,
        missingModelCandidates: undefined,
        missingMediaCandidates: undefined
      })
    })

    it('should always surface missing nodes regardless of settings', () => {
      vi.spyOn(useSettingStore(), 'get').mockReturnValue(false)

      const workflow = createWorkflow({
        missingNodeTypes: ['CustomNode1']
      })

      useWorkflowService().showPendingWarnings(workflow)

      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledWith(['CustomNode1'])
      expect(workflow.pendingWarnings).not.toBeNull()
    })

    it('should restore cached warnings on repeated calls', () => {
      const workflow = createWorkflow({
        missingNodeTypes: ['CustomNode1']
      })

      const service = useWorkflowService()
      service.showPendingWarnings(workflow)
      service.showPendingWarnings(workflow)

      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledTimes(2)
    })

    it('should NOT call showErrorOverlay when silent is true even with missing nodes', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation(
        (key: string): boolean => {
          if (key === 'Comfy.Workflow.ShowMissingModelsWarning') return true
          if (key === 'Comfy.RightSidePanel.ShowErrorsTab') return true
          return false
        }
      )
      const workflow = createWorkflow({
        missingNodeTypes: ['CustomNode1']
      })

      useWorkflowService().showPendingWarnings(workflow, { silent: true })

      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledWith(['CustomNode1'])
      expect(useExecutionErrorStore().showErrorOverlay).not.toHaveBeenCalled()
    })

    it('should call showErrorOverlay when silent is false and missing nodes exist', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation(
        (key: string): boolean => {
          if (key === 'Comfy.Workflow.ShowMissingModelsWarning') return true
          if (key === 'Comfy.RightSidePanel.ShowErrorsTab') return true
          return false
        }
      )
      const workflow = createWorkflow({
        missingNodeTypes: ['CustomNode1']
      })

      useWorkflowService().showPendingWarnings(workflow)

      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledWith(['CustomNode1'])
      expect(useExecutionErrorStore().showErrorOverlay).toHaveBeenCalled()
    })
  })

  describe('beforeLoadNewGraph', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>

    beforeEach(() => {
      enableWarningSettings()
      workflowStore = useWorkflowStore()
    })

    it('forwards the clean flag to saveCurrentViewport', () => {
      workflowStore.activeWorkflow = createModeTestWorkflow()

      useWorkflowService().beforeLoadNewGraph(false)

      expect(subgraphNavigationMocks.saveCurrentViewport).toHaveBeenCalledWith(
        false
      )
    })

    it('arms suppression by default for a clean workflow load', () => {
      workflowStore.activeWorkflow = createModeTestWorkflow()

      useWorkflowService().beforeLoadNewGraph()

      expect(subgraphNavigationMocks.saveCurrentViewport).toHaveBeenCalledWith(
        true
      )
    })

    it('should cache missingModelCandidates and missingMediaCandidates to activeWorkflow.pendingWarnings', () => {
      const activeWorkflow = createModeTestWorkflow({
        path: 'workflows/test.json'
      })
      workflowStore.activeWorkflow = activeWorkflow

      const modelCandidates = [
        {
          nodeId: '1',
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          isAssetSupported: false,
          name: 'missing.safetensors',
          isMissing: true
        }
      ]
      const mediaCandidates = [
        {
          nodeId: '2',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image' as const,
          name: 'photo.png',
          isMissing: true
        }
      ]

      useMissingModelStore().missingModelCandidates = modelCandidates as never
      useMissingMediaStore().missingMediaCandidates = mediaCandidates as never

      useWorkflowService().beforeLoadNewGraph()

      expect(activeWorkflow.pendingWarnings).toEqual(
        expect.objectContaining({
          missingModelCandidates: modelCandidates,
          missingMediaCandidates: mediaCandidates
        })
      )
    })

    it('should stash node previews before app.clean() can revoke them', () => {
      const activeWorkflow = createModeTestWorkflow({
        path: 'workflows/test.json'
      })
      workflowStore.activeWorkflow = activeWorkflow
      const stashPreviews = vi.spyOn(
        useNodeOutputStore(),
        'stashPreviewsForWorkflow'
      )

      useWorkflowService().beforeLoadNewGraph()

      expect(stashPreviews).toHaveBeenCalledWith(activeWorkflow.path)
    })

    it('should save active workflow state through the V2 draft store', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation((key: string) => {
        return key === 'Comfy.Workflow.Persist'
      })
      const activeWorkflow = createModeTestWorkflow({
        path: 'workflows/test.json'
      })
      workflowStore.activeWorkflow = activeWorkflow

      useWorkflowService().beforeLoadNewGraph()

      expect(draftStoreMocks.saveDraft).toHaveBeenCalledWith(
        activeWorkflow.path,
        JSON.stringify(activeWorkflow.activeState),
        {
          name: activeWorkflow.key,
          isTemporary: activeWorkflow.isTemporary
        }
      )
    })

    it('should show an error toast when the V2 draft store cannot save', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation((key: string) => {
        return key === 'Comfy.Workflow.Persist'
      })
      const addToastSpy = vi.spyOn(useToastStore(), 'add')
      draftStoreMocks.saveDraft.mockReturnValue(false)
      const activeWorkflow = createModeTestWorkflow({
        path: 'workflows/test.json'
      })
      workflowStore.activeWorkflow = activeWorkflow

      useWorkflowService().beforeLoadNewGraph()

      expect(addToastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          summary: t('g.error'),
          detail: t('toastMessages.failedToSaveDraft')
        })
      )
    })

    it('should log and show an error toast when the V2 draft store throws', () => {
      vi.spyOn(useSettingStore(), 'get').mockImplementation((key: string) => {
        return key === 'Comfy.Workflow.Persist'
      })
      const addToastSpy = vi.spyOn(useToastStore(), 'add')
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const error = new Error('storage unavailable')
      draftStoreMocks.saveDraft.mockImplementation(() => {
        throw error
      })
      const activeWorkflow = createModeTestWorkflow({
        path: 'workflows/test.json'
      })
      workflowStore.activeWorkflow = activeWorkflow

      try {
        useWorkflowService().beforeLoadNewGraph()

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to persist active workflow draft',
          error
        )
        expect(addToastSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            severity: 'error',
            summary: t('g.error'),
            detail: t('toastMessages.failedToSaveDraft')
          })
        )
      } finally {
        consoleErrorSpy.mockRestore()
      }
    })
  })

  describe('openWorkflow ordering', () => {
    it('re-selecting the active workflow with no loads pending is a no-op', async () => {
      const workflowStore = useWorkflowStore()
      const active = createWorkflow(null, {
        loadable: true,
        path: 'workflows/active-noop.json'
      })
      workflowStore.activeWorkflow = active as LoadedComfyWorkflow
      const service = useWorkflowService()

      await service.openWorkflow(active)
      expect(app.loadGraphData).not.toHaveBeenCalled()

      await service.openWorkflow(active, { force: true })
      expect(app.loadGraphData).toHaveBeenCalledTimes(1)
    })

    it('re-opens a workflow normally once its close has settled', async () => {
      const workflowStore = useWorkflowStore()
      const cycled = createWorkflow(null, {
        loadable: true,
        path: 'workflows/close-then-reopen.json'
      })
      Object.defineProperty(cycled, 'unload', { value: vi.fn() })
      const service = useWorkflowService()

      await expect(
        service.closeWorkflow(cycled, { warnIfUnsaved: false })
      ).resolves.toBe(true)

      workflowStore.activeWorkflow = null
      await service.openWorkflow(cycled)

      expect(app.loadGraphData).toHaveBeenCalledTimes(1)
      expect(vi.mocked(app.loadGraphData).mock.calls[0][3]).toBe(cycled)
    })

    it('falls back to the default workflow when closing the last, inactive workflow', async () => {
      const workflowStore = useWorkflowStore()
      const lastOpen = createWorkflow(null, {
        loadable: true,
        path: 'workflows/last-inactive.json'
      })
      Object.defineProperty(lastOpen, 'unload', { value: vi.fn() })
      workflowStore.attachWorkflow(lastOpen, 0)
      workflowStore.activeWorkflow = null
      const service = useWorkflowService()

      await expect(
        service.closeWorkflow(lastOpen, { warnIfUnsaved: false })
      ).resolves.toBe(true)

      // loadDefaultWorkflow is detected by its payload, not by a missing
      // workflow argument: the call must carry the default graph itself.
      expect(app.loadGraphData).toHaveBeenCalledTimes(1)
      expect(vi.mocked(app.loadGraphData).mock.calls[0][0]).toBe(defaultGraph)
      expect(vi.mocked(app.loadGraphData).mock.calls[0][3]).toBeUndefined()
    })

    it('keeps the tab open and its draft intact when the replacement load fails', async () => {
      const workflowStore = useWorkflowStore()
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const replacement = createWorkflow(null, {
        loadable: true,
        path: 'workflows/replacement.json'
      })
      workflowStore.attachWorkflow(closing, 0)
      workflowStore.attachWorkflow(replacement, 1)
      workflowStore.activeWorkflow = closing as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(
        replacement as LoadedComfyWorkflow
      )
      const storeClose = vi.spyOn(workflowStore, 'closeWorkflow')
      const error = new Error('replacement load failed')
      vi.mocked(app.loadGraphData).mockRejectedValueOnce(error)
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)

      await expect(
        useWorkflowService().closeWorkflow(closing, { warnIfUnsaved: false })
      ).rejects.toBe(error)

      // The Aug-12 review's baked-in gap, un-baked: a tab that failed to
      // close must keep its draft.
      expect(storeClose).not.toHaveBeenCalled()
      expect(draftStoreMocks.removeDraft).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it('keeps the tab and draft when the replacement load reports failure', async () => {
      const workflowStore = useWorkflowStore()
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const replacement = createWorkflow(null, {
        loadable: true,
        path: 'workflows/replacement.json'
      })
      workflowStore.attachWorkflow(closing, 0)
      workflowStore.attachWorkflow(replacement, 1)
      workflowStore.activeWorkflow = closing as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(
        replacement as LoadedComfyWorkflow
      )
      const storeClose = vi.spyOn(workflowStore, 'closeWorkflow')
      // The REAL configure-failure shape (christian-byrne's 16075 review):
      // loadGraphData shows the dialog itself and RESOLVES false - it never
      // rejects - so the guard must read the outcome, not rely on a throw.
      vi.mocked(app.loadGraphData).mockResolvedValueOnce(false)

      await expect(
        useWorkflowService().closeWorkflow(closing, { warnIfUnsaved: false })
      ).resolves.toBe(false)

      expect(storeClose).not.toHaveBeenCalled()
      expect(draftStoreMocks.removeDraft).not.toHaveBeenCalled()
      expect(workflowStore.openWorkflows.map((open) => open.path)).toContain(
        'workflows/closing.json'
      )
      // The failed load's intent is released (guarded no-op when the hash
      // publish already superseded it) - pins the sibling of the catch path.
      expect(
        subgraphNavigationMocks.endWorkflowNavigation
      ).toHaveBeenCalledWith(1)
    })

    it('keeps the last tab and its draft when the default load reports failure', async () => {
      const workflowStore = useWorkflowStore()
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      workflowStore.attachWorkflow(closing, 0)
      workflowStore.activeWorkflow = closing as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(null)
      const storeClose = vi.spyOn(workflowStore, 'closeWorkflow')
      // Traverses loadDefaultWorkflow's boolean, not openWorkflow's: the
      // last-tab close is the branch where a dead guard deletes the only
      // draft the editor could not repaint.
      vi.mocked(app.loadGraphData).mockResolvedValueOnce(false)

      await expect(
        useWorkflowService().closeWorkflow(closing, { warnIfUnsaved: false })
      ).resolves.toBe(false)

      expect(storeClose).not.toHaveBeenCalled()
      expect(draftStoreMocks.removeDraft).not.toHaveBeenCalled()
      expect(workflowStore.openWorkflows.map((open) => open.path)).toContain(
        'workflows/closing.json'
      )
    })

    it('repaints the retained workflow when a replacement load reports failure', async () => {
      const workflowStore = useWorkflowStore()
      const retained = createWorkflow(null, {
        loadable: true,
        path: 'workflows/retained.json'
      })
      const failing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/failing.json'
      })
      workflowStore.attachWorkflow(retained, 0)
      workflowStore.attachWorkflow(failing, 1)
      workflowStore.activeWorkflow = retained as LoadedComfyWorkflow
      vi.mocked(app.loadGraphData).mockClear()
      vi.mocked(app.loadGraphData).mockResolvedValueOnce(false)

      await expect(useWorkflowService().openWorkflow(failing)).resolves.toBe(
        false
      )

      // Second call = the retained workflow repainted from its saved state,
      // so selection, canvas, and change tracking agree after the abort.
      const calls = vi.mocked(app.loadGraphData).mock.calls
      expect(calls).toHaveLength(2)
      expect(calls[1][3]).toMatchObject({ path: 'workflows/retained.json' })
      expect(calls[1][0]).toEqual(retained.activeState)
      expect(workflowStore.activeWorkflow?.path).toBe('workflows/retained.json')
    })

    it('serializes rapid workflow opens so the final selection stays active', async () => {
      const workflowStore = useWorkflowStore()
      const first = createWorkflow(null, {
        loadable: true,
        path: 'workflows/first.json'
      })
      const second = createWorkflow(null, {
        loadable: true,
        path: 'workflows/second.json'
      })
      workflowStore.activeWorkflow = second as LoadedComfyWorkflow
      let resolveFirst: (() => void) | undefined
      let concurrentLoads = 0
      let maxConcurrentLoads = 0

      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          concurrentLoads++
          maxConcurrentLoads = Math.max(maxConcurrentLoads, concurrentLoads)
          if (workflow === first) {
            await new Promise<void>((resolve) => {
              resolveFirst = resolve
            })
          }
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          concurrentLoads--
          return true
        }
      )

      const firstOpen = useWorkflowService().openWorkflow(first)
      await vi.waitFor(() => {
        expect(app.loadGraphData).toHaveBeenCalledTimes(1)
      })
      const secondOpen = useWorkflowService().openWorkflow(second)
      await Promise.resolve()

      expect(app.loadGraphData).toHaveBeenCalledTimes(1)
      resolveFirst?.()
      await Promise.all([firstOpen, secondOpen])

      expect(maxConcurrentLoads).toBe(1)
      expect(
        vi.mocked(app.loadGraphData).mock.calls.map((call) => call[3])
      ).toEqual([first, second])
      expect(
        vi
          .mocked(app.loadGraphData)
          .mock.calls.map((call) => call[4]?.workflowNavigationId)
      ).toEqual([1, 2])
      expect(workflowStore.activeWorkflow?.path).toBe(second.path)
    })

    it('continues with the next workflow when the previous load fails', async () => {
      const workflowStore = useWorkflowStore()
      const first = createWorkflow(null, {
        loadable: true,
        path: 'workflows/first.json'
      })
      const second = createWorkflow(null, {
        loadable: true,
        path: 'workflows/second.json'
      })
      const error = new Error('load failed')
      workflowStore.activeWorkflow = second as LoadedComfyWorkflow

      vi.mocked(app.loadGraphData)
        .mockRejectedValueOnce(error)
        .mockImplementationOnce(async (_data, _clean, _restore, workflow) => {
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        })

      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      const firstOpen = useWorkflowService().openWorkflow(first)
      const secondOpen = useWorkflowService().openWorkflow(second)

      await expect(firstOpen).rejects.toBe(error)
      await expect(secondOpen).resolves.toBe(true)
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('queued workflow load failed'),
        error
      )
      expect(reportErrorMock).toHaveBeenCalledWith(error, {
        errorType: 'workflow_load_failure'
      })
      expect(
        subgraphNavigationMocks.endWorkflowNavigation
      ).toHaveBeenCalledWith(1)
      consoleError.mockRestore()
      expect(
        vi.mocked(app.loadGraphData).mock.calls.map((call) => call[3])
      ).toEqual([first, second])
      expect(workflowStore.activeWorkflow?.path).toBe(second.path)
    })

    it('closes an inactive workflow without waiting for an unrelated load', async () => {
      const workflowStore = useWorkflowStore()
      const current = createWorkflow(null, {
        loadable: true,
        path: 'workflows/current.json'
      })
      const loading = createWorkflow(null, {
        loadable: true,
        path: 'workflows/loading.json'
      })
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      let resolveLoad: (() => void) | undefined

      workflowStore.attachWorkflow(current, 0)
      workflowStore.attachWorkflow(loading, 1)
      workflowStore.attachWorkflow(closing, 2)
      workflowStore.activeWorkflow = current as LoadedComfyWorkflow
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow === loading) {
            await new Promise<void>((resolve) => {
              resolveLoad = resolve
            })
          }
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )

      const service = useWorkflowService()
      const loadingOpen = service.openWorkflow(loading)
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())

      await expect(
        service.closeWorkflow(closing, { warnIfUnsaved: false })
      ).resolves.toBe(true)
      expect(workflowStore.openWorkflows).not.toContain(closing)

      resolveLoad?.()
      await loadingOpen
    })

    it('waits for a workflow in flight before closing it', async () => {
      const workflowStore = useWorkflowStore()
      const current = createWorkflow(null, {
        loadable: true,
        path: 'workflows/current.json'
      })
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      let resolveLoad: (() => void) | undefined

      workflowStore.attachWorkflow(current, 0)
      workflowStore.attachWorkflow(closing, 1)
      workflowStore.activeWorkflow = current as LoadedComfyWorkflow
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow === closing) {
            await new Promise<void>((resolve) => {
              resolveLoad = resolve
            })
          }
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )

      const service = useWorkflowService()
      const opening = service.openWorkflow(closing)
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
      let closeSettled = false
      const close = service
        .closeWorkflow(closing, { warnIfUnsaved: false })
        .finally(() => {
          closeSettled = true
        })
      await Promise.resolve()
      expect(closeSettled).toBe(false)

      resolveLoad?.()
      await Promise.all([opening, close])
      expect(workflowStore.openWorkflows).not.toContain(closing)
    })

    it('does not extend an inactive close with a later unrelated load', async () => {
      const workflowStore = useWorkflowStore()
      const current = createWorkflow(null, {
        loadable: true,
        path: 'workflows/current.json'
      })
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const unrelated = createWorkflow(null, {
        loadable: true,
        path: 'workflows/unrelated.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      const closingError = new Error('closing load failed')
      let rejectClosing: ((error: Error) => void) | undefined
      let resolveUnrelated: (() => void) | undefined
      let unrelatedStarted = false

      workflowStore.attachWorkflow(current, 0)
      workflowStore.attachWorkflow(closing, 1)
      workflowStore.attachWorkflow(unrelated, 2)
      workflowStore.activeWorkflow = current as LoadedComfyWorkflow
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow === closing) {
            await new Promise<void>((_resolve, reject) => {
              rejectClosing = reject
            })
          }
          if (workflow === unrelated) {
            unrelatedStarted = true
            await new Promise<void>((resolve) => {
              resolveUnrelated = resolve
            })
          }
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )

      const service = useWorkflowService()
      const opening = service.openWorkflow(closing)
      const openingResult = opening.catch((error: unknown) => error)
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())

      let closeSettled = false
      const close = service
        .closeWorkflow(closing, { warnIfUnsaved: false })
        .finally(() => {
          closeSettled = true
        })
      const unrelatedOpen = service.openWorkflow(unrelated)

      rejectClosing?.(closingError)
      expect(await openingResult).toBe(closingError)
      await vi.waitFor(() => expect(unrelatedStarted).toBe(true))
      await vi.waitFor(() => expect(closeSettled).toBe(true))
      expect(workflowStore.openWorkflows).not.toContain(closing)

      resolveUnrelated?.()
      await Promise.all([close, unrelatedOpen])
    })

    it('falls back to the next tab when activation history is empty', async () => {
      const workflowStore = useWorkflowStore()
      const first = createWorkflow(null, {
        loadable: true,
        path: 'workflows/first.json'
      })
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const next = createWorkflow(null, {
        loadable: true,
        path: 'workflows/next.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })

      workflowStore.attachWorkflow(first, 0)
      workflowStore.attachWorkflow(closing, 1)
      workflowStore.attachWorkflow(next, 2)
      workflowStore.activeWorkflow = closing as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(null)
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )

      await useWorkflowService().closeWorkflow(closing, {
        warnIfUnsaved: false
      })

      expect(workflowStore.activeWorkflow?.path).toBe(next.path)
      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.anything(),
        true,
        true,
        next,
        expect.anything()
      )
    })

    it('keeps a workflow closed when its queued open settles later', async () => {
      const workflowStore = useWorkflowStore()
      const current = createWorkflow(null, {
        loadable: true,
        path: 'workflows/current.json'
      })
      const first = createWorkflow(null, {
        loadable: true,
        path: 'workflows/first.json'
      })
      const second = createWorkflow(null, {
        loadable: true,
        path: 'workflows/second.json'
      })
      Object.defineProperty(second, 'unload', { value: vi.fn() })
      let resolveFirst: (() => void) | undefined

      workflowStore.attachWorkflow(current, 0)
      workflowStore.attachWorkflow(first, 1)
      workflowStore.attachWorkflow(second, 2)
      workflowStore.activeWorkflow = current as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(current)
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow === first) {
            await new Promise<void>((resolve) => {
              resolveFirst = resolve
            })
          }
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )

      const service = useWorkflowService()
      const firstOpen = service.openWorkflow(first)
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
      const secondOpen = service.openWorkflow(second)
      const close = service.closeWorkflow(second, { warnIfUnsaved: false })
      resolveFirst?.()

      await Promise.all([firstOpen, secondOpen, close])

      expect(workflowStore.openWorkflows).not.toContain(second)
      expect(workflowStore.activeWorkflow?.path).toBe(current.path)
    })

    it('does not let an older close override a newer workflow selection', async () => {
      const workflowStore = useWorkflowStore()
      const current = createWorkflow(null, {
        loadable: true,
        path: 'workflows/current.json'
      })
      const first = createWorkflow(null, {
        loadable: true,
        path: 'workflows/first.json'
      })
      const second = createWorkflow(null, {
        loadable: true,
        path: 'workflows/second.json'
      })
      const final = createWorkflow(null, {
        loadable: true,
        path: 'workflows/final.json'
      })
      Object.defineProperty(second, 'unload', { value: vi.fn() })
      let resolveFirst: (() => void) | undefined

      workflowStore.attachWorkflow(current, 0)
      workflowStore.attachWorkflow(first, 1)
      workflowStore.attachWorkflow(second, 2)
      workflowStore.attachWorkflow(final, 3)
      workflowStore.activeWorkflow = current as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(current)
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow === first) {
            await new Promise<void>((resolve) => {
              resolveFirst = resolve
            })
          }
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )

      const service = useWorkflowService()
      const firstOpen = service.openWorkflow(first)
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
      const secondOpen = service.openWorkflow(second)
      const close = service.closeWorkflow(second, { warnIfUnsaved: false })
      const finalOpen = service.openWorkflow(final)
      resolveFirst?.()

      await Promise.all([firstOpen, secondOpen, close, finalOpen])

      expect(workflowStore.openWorkflows).not.toContain(second)
      expect(workflowStore.activeWorkflow?.path).toBe(final.path)
      expect(
        vi.mocked(app.loadGraphData).mock.calls.map((call) => call[3])
      ).toEqual([first, second, final])
    })

    it('falls back after a newer workflow selection fails', async () => {
      const workflowStore = useWorkflowStore()
      const current = createWorkflow(null, {
        loadable: true,
        path: 'workflows/current.json'
      })
      const first = createWorkflow(null, {
        loadable: true,
        path: 'workflows/first.json'
      })
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const failing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/failing.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      let resolveFirst: (() => void) | undefined

      workflowStore.attachWorkflow(current, 0)
      workflowStore.attachWorkflow(first, 1)
      workflowStore.attachWorkflow(closing, 2)
      workflowStore.attachWorkflow(failing, 3)
      workflowStore.activeWorkflow = current as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(current)
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow === first) {
            await new Promise<void>((resolve) => {
              resolveFirst = resolve
            })
          }
          if (workflow === failing) throw new Error('load failed')
          workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          return true
        }
      )

      const service = useWorkflowService()
      const firstOpen = service.openWorkflow(first)
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
      const closingOpen = service.openWorkflow(closing)
      const close = service.closeWorkflow(closing, { warnIfUnsaved: false })
      const failingOpen = service.openWorkflow(failing)
      resolveFirst?.()

      await Promise.all([
        firstOpen,
        closingOpen,
        close,
        expect(failingOpen).rejects.toThrow('load failed')
      ])

      expect(workflowStore.openWorkflows).not.toContain(closing)
      expect(workflowStore.activeWorkflow?.path).toBe(current.path)
    })

    it('serializes a newer selection after the last-tab replacement', async () => {
      const workflowStore = useWorkflowStore()
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const replacement = createWorkflow(null, {
        loadable: true,
        path: 'workflows/replacement.json'
      })
      const final = createWorkflow(null, {
        loadable: true,
        path: 'workflows/final.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      let resolveDefault: (() => void) | undefined
      let concurrentLoads = 0
      let maxConcurrentLoads = 0

      workflowStore.attachWorkflow(closing, 0)
      workflowStore.activeWorkflow = closing as LoadedComfyWorkflow
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          concurrentLoads++
          maxConcurrentLoads = Math.max(maxConcurrentLoads, concurrentLoads)
          if (!workflow) {
            await new Promise<void>((resolve) => {
              resolveDefault = () => {
                workflowStore.attachWorkflow(replacement, 1)
                workflowStore.activeWorkflow =
                  replacement as LoadedComfyWorkflow
                resolve()
              }
            })
          } else {
            workflowStore.attachWorkflow(final, 2)
            workflowStore.activeWorkflow = final as LoadedComfyWorkflow
          }
          concurrentLoads--
          return true
        }
      )

      const service = useWorkflowService()
      const close = service.closeWorkflow(closing, { warnIfUnsaved: false })
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
      const finalOpen = service.openWorkflow(final)
      await Promise.resolve()

      expect(app.loadGraphData).toHaveBeenCalledOnce()
      resolveDefault?.()
      await Promise.all([close, finalOpen])

      expect(maxConcurrentLoads).toBe(1)
      expect(workflowStore.openWorkflows).not.toContain(closing)
      expect(workflowStore.activeWorkflow?.path).toBe(final.path)
      expect(
        vi.mocked(app.loadGraphData).mock.calls.map((call) => call[3])
      ).toEqual([undefined, final])
    })

    it('does not reopen the workflow being closed', async () => {
      const workflowStore = useWorkflowStore()
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const replacement = createWorkflow(null, {
        loadable: true,
        path: 'workflows/replacement.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      let resolveDefault: (() => void) | undefined

      workflowStore.attachWorkflow(closing, 0)
      workflowStore.activeWorkflow = closing as LoadedComfyWorkflow
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow) {
            workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
            return true
          }
          await new Promise<void>((resolve) => {
            resolveDefault = () => {
              workflowStore.attachWorkflow(replacement, 1)
              workflowStore.activeWorkflow = replacement as LoadedComfyWorkflow
              resolve()
            }
          })
          return true
        }
      )

      const service = useWorkflowService()
      const close = service.closeWorkflow(closing, { warnIfUnsaved: false })
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledOnce())
      const staleOpen = service.openWorkflow(closing)
      resolveDefault?.()

      await Promise.all([close, staleOpen])

      expect(app.loadGraphData).toHaveBeenCalledOnce()
      expect(workflowStore.openWorkflows).not.toContain(closing)
      expect(workflowStore.activeWorkflow?.path).toBe(replacement.path)
    })

    it('keeps a valid active workflow when closing tabs concurrently', async () => {
      const workflowStore = useWorkflowStore()
      const first = createWorkflow(null, {
        loadable: true,
        path: 'workflows/first.json'
      })
      const second = createWorkflow(null, {
        loadable: true,
        path: 'workflows/second.json'
      })
      const replacement = createWorkflow(null, {
        loadable: true,
        path: 'workflows/replacement.json'
      })
      Object.defineProperty(first, 'unload', { value: vi.fn() })
      Object.defineProperty(second, 'unload', { value: vi.fn() })

      workflowStore.attachWorkflow(first, 0)
      workflowStore.attachWorkflow(second, 1)
      workflowStore.activeWorkflow = first as LoadedComfyWorkflow
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow) return true
          workflowStore.attachWorkflow(replacement, 2)
          workflowStore.activeWorkflow = replacement as LoadedComfyWorkflow
          return true
        }
      )

      const service = useWorkflowService()
      await Promise.all([
        service.closeWorkflow(first, { warnIfUnsaved: false }),
        service.closeWorkflow(second, { warnIfUnsaved: false })
      ])

      expect(app.loadGraphData).toHaveBeenCalledOnce()
      expect(workflowStore.openWorkflows).not.toContain(first)
      expect(workflowStore.openWorkflows).not.toContain(second)
      expect(workflowStore.activeWorkflow?.path).toBe(replacement.path)
    })

    it('never selects a workflow that is itself closing as the replacement', async () => {
      const workflowStore = useWorkflowStore()
      const active = createWorkflow(null, {
        loadable: true,
        path: 'workflows/active.json'
      })
      const alsoClosing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/also-closing.json'
      })
      const survivor = createWorkflow(null, {
        loadable: true,
        path: 'workflows/survivor.json'
      })
      for (const wf of [active, alsoClosing, survivor]) {
        Object.defineProperty(wf, 'unload', { value: vi.fn() })
      }
      workflowStore.attachWorkflow(active, 0)
      workflowStore.attachWorkflow(alsoClosing, 1)
      workflowStore.attachWorkflow(survivor, 2)
      workflowStore.activeWorkflow = active as LoadedComfyWorkflow
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(
        alsoClosing as LoadedComfyWorkflow
      )

      // Hold alsoClosing's pending open so its close stays registered as
      // closing while the active close chooses its replacement.
      let releaseHeldLoad = (): void => {}
      vi.mocked(app.loadGraphData).mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            releaseHeldLoad = () => resolve(true)
          })
      )
      const heldOpen = useWorkflowService().openWorkflow(alsoClosing)
      const closingOther = useWorkflowService().closeWorkflow(alsoClosing, {
        warnIfUnsaved: false
      })

      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow) {
            workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          }
          return true
        }
      )
      const closingActive = useWorkflowService().closeWorkflow(active, {
        warnIfUnsaved: false
      })
      await Promise.resolve()
      releaseHeldLoad()
      await Promise.all([heldOpen, closingOther, closingActive])

      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.anything(),
        true,
        true,
        survivor,
        expect.anything()
      )
      expect(workflowStore.activeWorkflow?.path).toBe(survivor.path)
    })

    it('skips a closing candidate in the index-shift fallback', async () => {
      const workflowStore = useWorkflowStore()
      const active = createWorkflow(null, {
        loadable: true,
        path: 'workflows/active.json'
      })
      const closingNeighbor = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing-neighbor.json'
      })
      const survivor = createWorkflow(null, {
        loadable: true,
        path: 'workflows/survivor.json'
      })
      for (const wf of [active, closingNeighbor, survivor]) {
        Object.defineProperty(wf, 'unload', { value: vi.fn() })
      }
      workflowStore.attachWorkflow(active, 0)
      workflowStore.attachWorkflow(closingNeighbor, 1)
      workflowStore.attachWorkflow(survivor, 2)
      workflowStore.activeWorkflow = active as LoadedComfyWorkflow
      // No most-recent candidate: the decision goes straight to the
      // index-shift fallback, whose first candidate is the closing neighbor.
      vi.spyOn(workflowStore, 'getMostRecentWorkflow').mockReturnValue(null)

      // Hold the neighbor's close INSIDE the store call: this is the window
      // where it is still in openWorkflows (the store removal has not run)
      // while the closing registry already holds it - the exact state the
      // fallback guard exists for.
      const storeCloseReleases: (() => void)[] = []
      const storeClose = vi
        .spyOn(workflowStore, 'closeWorkflow')
        .mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              storeCloseReleases.push(resolve)
            })
        )
      const closingNeighborPromise = useWorkflowService().closeWorkflow(
        closingNeighbor,
        { warnIfUnsaved: false }
      )
      await Promise.resolve()

      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow) {
            workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
          }
          return true
        }
      )
      const closingActive = useWorkflowService().closeWorkflow(active, {
        warnIfUnsaved: false
      })
      // The replacement decision is a synchronous walk a few microtasks in;
      // it must run while the neighbor's held store-close keeps the closing
      // window open, so drain the microtask queue before releasing.
      for (let tick = 0; tick < 8; tick++) await Promise.resolve()
      storeClose.mockImplementation(async () => {})
      while (storeCloseReleases.length) storeCloseReleases.shift()?.()
      await Promise.all([closingNeighborPromise, closingActive])

      const loadedPaths = vi
        .mocked(app.loadGraphData)
        .mock.calls.map(
          (call) => (call?.[3] as { path?: string } | undefined)?.path
        )
      expect(loadedPaths).toContain(survivor.path)
      expect(loadedPaths).not.toContain(closingNeighbor.path)
    })

    it('reopens a renamed path after a close that renamed the workflow mid-flight', async () => {
      const workflowStore = useWorkflowStore()
      const renamed = createWorkflow(null, {
        loadable: true,
        path: 'workflows/original.json'
      })
      Object.defineProperty(renamed, 'unload', { value: vi.fn() })
      Object.defineProperty(renamed, 'path', {
        value: 'workflows/original.json',
        writable: true
      })
      workflowStore.attachWorkflow(renamed, 0)

      // Hold the workflow's pending open so its close parks on the await,
      // giving the rename a real mid-close window.
      let releaseHeldLoad = (): void => {}
      vi.mocked(app.loadGraphData).mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            releaseHeldLoad = () => resolve(true)
          })
      )
      const heldOpen = useWorkflowService().openWorkflow(renamed)
      const closing = useWorkflowService().closeWorkflow(renamed, {
        warnIfUnsaved: false
      })
      await Promise.resolve()
      // A rename mid-close mutates the live path; the closing registry must
      // not key on it, or the ORIGINAL path stays suppressed forever.
      ;(renamed as { path: string }).path = 'workflows/renamed.json'
      releaseHeldLoad()
      vi.mocked(app.loadGraphData).mockImplementation(async () => true)
      await Promise.all([heldOpen, closing])

      const reopened = createWorkflow(null, {
        loadable: true,
        path: 'workflows/original.json'
      })
      workflowStore.attachWorkflow(reopened, 0)
      vi.mocked(app.loadGraphData).mockClear()
      await useWorkflowService().openWorkflow(reopened)

      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.anything(),
        true,
        true,
        reopened,
        expect.anything()
      )
    })

    it('skips the last-close default load when a workflow opened during the close', async () => {
      const workflowStore = useWorkflowStore()
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const openedMidClose = createWorkflow(null, {
        loadable: true,
        path: 'workflows/opened-mid-close.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      workflowStore.attachWorkflow(closing, 0)

      // Hold the closing workflow's own pending open so the close awaits it.
      let releaseHeldLoad = (): void => {}
      vi.mocked(app.loadGraphData).mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            releaseHeldLoad = () => resolve(true)
          })
      )
      const heldOpen = useWorkflowService().openWorkflow(closing)
      const closePromise = useWorkflowService().closeWorkflow(closing, {
        warnIfUnsaved: false
      })
      await Promise.resolve()

      // Another workflow arrives while the close is awaiting - the stale
      // "was last open" answer must not fire a default-workflow load.
      workflowStore.attachWorkflow(openedMidClose, 1)
      vi.mocked(app.loadGraphData).mockImplementation(async () => true)
      releaseHeldLoad()
      await Promise.all([heldOpen, closePromise])

      const defaultLoads = vi
        .mocked(app.loadGraphData)
        .mock.calls.filter((call) => call[3] === undefined)
        .filter((call) => call[0] !== undefined && call.length === 1)
      expect(defaultLoads).toHaveLength(0)
      expect(workflowStore.openWorkflows.map((wf) => wf.path)).toContain(
        openedMidClose.path
      )
    })

    it('does not reopen a workflow while a duplicate close remains active', async () => {
      const workflowStore = useWorkflowStore()
      const closing = createWorkflow(null, {
        loadable: true,
        path: 'workflows/closing.json'
      })
      const replacement = createWorkflow(null, {
        loadable: true,
        path: 'workflows/replacement.json'
      })
      Object.defineProperty(closing, 'unload', { value: vi.fn() })
      let resolveReplacement: (() => void) | undefined
      let defaultLoadCount = 0

      workflowStore.attachWorkflow(closing, 0)
      workflowStore.activeWorkflow = closing as LoadedComfyWorkflow
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, workflow) => {
          if (workflow && typeof workflow !== 'string') {
            workflowStore.attachWorkflow(workflow, 0)
            workflowStore.activeWorkflow = workflow as LoadedComfyWorkflow
            return true
          }

          defaultLoadCount++
          if (defaultLoadCount === 1) throw new Error('replacement failed')
          await new Promise<void>((resolve) => {
            resolveReplacement = () => {
              workflowStore.attachWorkflow(replacement, 1)
              workflowStore.activeWorkflow = replacement as LoadedComfyWorkflow
              resolve()
            }
          })
          return true
        }
      )

      const service = useWorkflowService()
      const firstClose = service.closeWorkflow(closing, {
        warnIfUnsaved: false
      })
      const secondClose = service.closeWorkflow(closing, {
        warnIfUnsaved: false
      })

      await expect(firstClose).rejects.toThrow('replacement failed')
      await vi.waitFor(() => expect(app.loadGraphData).toHaveBeenCalledTimes(2))
      const staleOpen = service.openWorkflow(closing)
      resolveReplacement?.()
      await Promise.all([secondClose, staleOpen])

      expect(app.loadGraphData).toHaveBeenCalledTimes(2)
      expect(workflowStore.openWorkflows).not.toContain(closing)
      expect(workflowStore.activeWorkflow?.path).toBe(replacement.path)
    })
  })

  describe('openWorkflow deferred warnings', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>

    beforeEach(() => {
      enableWarningSettings()
      workflowStore = useWorkflowStore()
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, wf) => {
          workflowStore.activeWorkflow = wf as LoadedComfyWorkflow
          return true
        }
      )
    })

    it('should defer warnings during load and show on focus', async () => {
      const workflow = createWorkflow(
        { missingNodeTypes: ['CustomNode1'] },
        { loadable: true }
      )

      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).not.toHaveBeenCalled()

      await useWorkflowService().openWorkflow(workflow)

      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.anything(),
        true,
        true,
        workflow,
        expect.objectContaining({ deferWarnings: true })
      )
      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledWith(['CustomNode1'])
      expect(workflow.pendingWarnings).not.toBeNull()
    })

    it('should show each workflow warnings only when that tab is focused', async () => {
      const workflow1 = createWorkflow(
        { missingNodeTypes: ['MissingNodeA'] },
        { loadable: true, path: 'workflows/first.json' }
      )
      const workflow2 = createWorkflow(
        { missingNodeTypes: ['MissingNodeB'] },
        { loadable: true, path: 'workflows/second.json' }
      )

      const service = useWorkflowService()

      await service.openWorkflow(workflow1)
      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledTimes(1)
      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledWith(['MissingNodeA'])
      expect(workflow1.pendingWarnings).not.toBeNull()
      expect(workflow2.pendingWarnings).not.toBeNull()

      await service.openWorkflow(workflow2)
      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledTimes(2)
      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenLastCalledWith(['MissingNodeB'])
      expect(workflow2.pendingWarnings).not.toBeNull()
    })

    it('should restore cached warnings silently when refocusing a tab', async () => {
      const workflow = createWorkflow(
        { missingNodeTypes: ['CustomNode1'] },
        { loadable: true }
      )

      const service = useWorkflowService()

      await service.openWorkflow(workflow, { force: true })
      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledTimes(1)

      await service.openWorkflow(workflow, { force: true })
      // Cached warnings are restored on refocus
      expect(
        useMissingNodesErrorStore().surfaceMissingNodes
      ).toHaveBeenCalledTimes(2)
    })
  })

  describe('insertWorkflow', () => {
    it('does not insert while the canvas is picking-only', async () => {
      const workflow = { load: vi.fn() } as unknown as ComfyWorkflow
      Reflect.set(app.canvas, 'selectOnly', true)
      try {
        await useWorkflowService().insertWorkflow(workflow)

        expect(workflow.load).not.toHaveBeenCalled()
      } finally {
        Reflect.set(app.canvas, 'selectOnly', false)
      }
    })

    it('inserts when the canvas is editable', async () => {
      const deserialize = vi.fn()
      Reflect.set(app.canvas, '_deserializeItems', deserialize)
      const workflow = {
        load: vi.fn().mockResolvedValue({
          initialState: { nodes: [], links: [] }
        })
      } as unknown as ComfyWorkflow

      await useWorkflowService().insertWorkflow(workflow)

      expect(workflow.load).toHaveBeenCalledOnce()
      expect(deserialize).toHaveBeenCalledOnce()
    })
  })

  describe('saveWorkflow', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>

    beforeEach(() => {
      setActivePinia(createTestingPinia())
      workflowStore = useWorkflowStore()
    })

    it('should delegate to workflowStore.saveWorkflow for persisted workflows', async () => {
      const workflow = createModeTestWorkflow({
        path: 'workflows/persisted.json'
      })
      vi.mocked(workflowStore.saveWorkflow).mockResolvedValue()

      const result = await useWorkflowService().saveWorkflow(workflow)

      expect(result).toBe(true)
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(workflow)
    })

    it('should return false when temporary workflow save is cancelled', async () => {
      const workflow = createModeTestWorkflow({
        path: 'workflows/Unsaved Workflow.json'
      })
      Object.defineProperty(workflow, 'isTemporary', { get: () => true })
      vi.spyOn(workflow, 'promptSave').mockResolvedValue(null)

      const result = await useWorkflowService().saveWorkflow(workflow)

      expect(result).toBe(false)
      expect(workflowStore.saveWorkflow).not.toHaveBeenCalled()
    })
  })

  describe('closeWorkflow', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>
    let service: ReturnType<typeof useWorkflowService>

    beforeEach(() => {
      workflowStore = useWorkflowStore()
      service = useWorkflowService()
    })

    it('keeps a temporary workflow open when Save As is cancelled', async () => {
      const workflow = createModeTestWorkflow({
        path: 'workflows/Unsaved Workflow.json'
      })
      workflow.isModified = true
      Object.defineProperty(workflow, 'isTemporary', { get: () => true })
      vi.spyOn(workflow, 'promptSave').mockResolvedValue(null)
      mockConfirm.mockResolvedValue(true)

      const closed = await service.closeWorkflow(workflow)

      expect(closed).toBe(false)
      expect(workflowStore.closeWorkflow).not.toHaveBeenCalled()
    })

    it('should release the closed workflow node previews', async () => {
      const workflow = createModeTestWorkflow({
        path: 'workflows/closing.json'
      })
      const discardPreviews = vi.spyOn(
        useNodeOutputStore(),
        'discardPreviewsForWorkflow'
      )

      await service.closeWorkflow(workflow, { warnIfUnsaved: false })

      expect(discardPreviews).toHaveBeenCalledWith(workflow.path)
    })
  })

  describe('afterLoadNewGraph', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>
    let existingWorkflow: LoadedComfyWorkflow

    beforeEach(() => {
      setActivePinia(createTestingPinia())
      workflowStore = useWorkflowStore()
      existingWorkflow = createModeTestWorkflow({
        path: 'workflows/repeat.json'
      })
      vi.mocked(workflowStore.getWorkflowByPath).mockReturnValue(
        existingWorkflow
      )
      vi.mocked(workflowStore.isActive).mockReturnValue(true)
      vi.mocked(workflowStore.openWorkflow).mockResolvedValue(existingWorkflow)
      vi.mocked(workflowStore.createNewTemporary).mockReturnValue(
        createModeTestWorkflow({ path: 'workflows/repeat (2).json' })
      )
    })

    it('should restore the stashed previews of the newly active workflow', async () => {
      workflowStore.activeWorkflow = existingWorkflow

      await useWorkflowService().afterLoadNewGraph('repeat', makeWorkflowData())

      expect(
        useNodeOutputStore().restorePreviewsForWorkflow
      ).toHaveBeenCalledWith(existingWorkflow.path)
    })

    it('should reuse equivalent UUIDs regardless of casing', async () => {
      const workflowId = '9cea40bb-b0cf-4b40-a758-8935cfe8d52f'
      existingWorkflow.changeTracker.activeState.id = workflowId

      await useWorkflowService().afterLoadNewGraph(
        'repeat',
        makeWorkflowDataWithId(workflowId.toUpperCase())
      )

      expect(workflowStore.getWorkflowByPath).toHaveBeenCalledWith(
        'workflows/repeat.json'
      )
      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalled()
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
      expect(workflowStore.createNewTemporary).not.toHaveBeenCalled()
    })

    it('should reuse active workflow for repeated same-path loads without ids', async () => {
      await useWorkflowService().afterLoadNewGraph('repeat', makeWorkflowData())

      expect(workflowStore.getWorkflowByPath).toHaveBeenCalledWith(
        'workflows/repeat.json'
      )
      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalled()
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
      expect(workflowStore.createNewTemporary).not.toHaveBeenCalled()
    })

    it('should reuse active workflow when only one side has an id', async () => {
      existingWorkflow.changeTracker.activeState.id =
        '9cea40bb-b0cf-4b40-a758-8935cfe8d52f'

      await useWorkflowService().afterLoadNewGraph('repeat', makeWorkflowData())

      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalled()
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
      expect(workflowStore.createNewTemporary).not.toHaveBeenCalled()
    })

    it('should reuse active workflow when only workflowData has an id', async () => {
      await useWorkflowService().afterLoadNewGraph(
        'repeat',
        makeWorkflowDataWithId('9cea40bb-b0cf-4b40-a758-8935cfe8d52f')
      )

      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalled()
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
      expect(workflowStore.createNewTemporary).not.toHaveBeenCalled()
    })

    it('should create new temporary when ids differ', async () => {
      existingWorkflow.changeTracker.activeState.id =
        '9cea40bb-b0cf-4b40-a758-8935cfe8d52f'

      await useWorkflowService().afterLoadNewGraph(
        'repeat',
        makeWorkflowDataWithId('11111111-2222-3333-4444-555555555555')
      )

      expect(workflowStore.createNewTemporary).toHaveBeenCalled()
    })

    it('stores share attribution on shared temporary workflows', async () => {
      vi.mocked(workflowStore.getWorkflowByPath).mockReturnValue(null)
      const tempWorkflow = createModeTestWorkflow({
        path: 'workflows/shared.json'
      })
      vi.mocked(workflowStore.createNewTemporary).mockReturnValue(tempWorkflow)
      vi.mocked(workflowStore.openWorkflow).mockResolvedValue(tempWorkflow)

      await useWorkflowService().afterLoadNewGraph(
        'shared',
        makeWorkflowData(),
        'share-1'
      )

      expect(tempWorkflow.shareId).toBe('share-1')
    })

    it('preserves share attribution on repeated same-path loads', async () => {
      existingWorkflow.shareId = 'share-1'

      await useWorkflowService().afterLoadNewGraph('repeat', makeWorkflowData())

      expect(existingWorkflow.shareId).toBe('share-1')
    })

    it('preserves share attribution on workflow object reloads', async () => {
      existingWorkflow.shareId = 'share-1'

      await useWorkflowService().afterLoadNewGraph(
        existingWorkflow,
        makeWorkflowData()
      )

      expect(existingWorkflow.shareId).toBe('share-1')
    })

    it('overwrites share attribution on repeated same-path loads with a new share id', async () => {
      existingWorkflow.shareId = 'share-1'

      await useWorkflowService().afterLoadNewGraph(
        'repeat',
        makeWorkflowData(),
        'share-2'
      )

      expect(existingWorkflow.shareId).toBe('share-2')
    })

    it('overwrites share attribution on workflow object reloads with a new share id', async () => {
      existingWorkflow.shareId = 'share-1'

      await useWorkflowService().afterLoadNewGraph(
        existingWorkflow,
        makeWorkflowData(),
        'share-2'
      )

      expect(existingWorkflow.shareId).toBe('share-2')
    })

    it('reuses a migrated workflow only for its original legacy id', async () => {
      const existingUuid = '9cea40bb-b0cf-4b40-a758-8935cfe8d52f'
      existingWorkflow.changeTracker.activeState.id = existingUuid
      existingWorkflow.legacyId = 'video-point-prompt-example'

      await useWorkflowService().afterLoadNewGraph(
        'repeat',
        makeWorkflowDataWithId('video-point-prompt-example')
      )

      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalledWith(
        expect.objectContaining({ id: existingUuid })
      )
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
      expect(workflowStore.createNewTemporary).not.toHaveBeenCalled()
    })

    it.for([
      {
        label: 'a different legacy id',
        existingId: 'legacy-workflow-name',
        incomingId: 'different-legacy-name'
      },
      {
        label: 'an unrelated legacy id after migration',
        existingId: '9cea40bb-b0cf-4b40-a758-8935cfe8d52f',
        incomingId: 'different-legacy-name',
        legacyId: 'legacy-workflow-name'
      }
    ])(
      'opens a new tab for $label',
      async ({ existingId, incomingId, legacyId }) => {
        existingWorkflow.changeTracker.activeState.id = existingId
        existingWorkflow.legacyId = legacyId

        await useWorkflowService().afterLoadNewGraph(
          'repeat',
          makeWorkflowDataWithId(incomingId)
        )

        expect(workflowStore.createNewTemporary).toHaveBeenCalled()
        expect(existingWorkflow.changeTracker.reset).not.toHaveBeenCalled()
      }
    )

    it('migrates a workflow-object reload and records its legacy id', async () => {
      const existingUuid = '9cea40bb-b0cf-4b40-a758-8935cfe8d52f'
      existingWorkflow.changeTracker.activeState.id = existingUuid

      await useWorkflowService().afterLoadNewGraph(
        existingWorkflow,
        makeWorkflowDataWithId('video-point-prompt-example')
      )

      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalledWith(
        expect.objectContaining({ id: existingUuid })
      )
      expect(existingWorkflow.legacyId).toBe('video-point-prompt-example')
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
    })

    it('generates a fresh UUID when a workflow-object reload has no valid id', async () => {
      existingWorkflow.changeTracker.activeState.id = 'legacy-workflow-name'

      await useWorkflowService().afterLoadNewGraph(
        existingWorkflow,
        makeWorkflowDataWithId('different-legacy-name')
      )

      const resetArg = vi.mocked(existingWorkflow.changeTracker.reset).mock
        .calls[0]?.[0]
      expect(isValidUuid(resetArg?.id)).toBe(true)
      expect(resetArg?.id).not.toBe('different-legacy-name')
      expect(resetArg?.id).not.toBe('legacy-workflow-name')
    })
  })

  describe('per-workflow mode switching', () => {
    let appMode: ReturnType<typeof useAppMode>
    let workflowStore: ReturnType<typeof useWorkflowStore>
    let service: ReturnType<typeof useWorkflowService>

    function mockOpenWorkflow() {
      vi.spyOn(workflowStore, 'openWorkflow').mockImplementation(async (wf) => {
        // Simulate load() setting changeTracker on first open
        if (!wf.changeTracker) {
          wf.changeTracker = createMockChangeTracker()
          wf.content = '{}'
          wf.originalContent = '{}'
        }
        const loaded = wf as LoadedComfyWorkflow
        workflowStore.activeWorkflow = loaded
        return loaded
      })
    }

    beforeEach(() => {
      appMode = useAppMode()
      workflowStore = useWorkflowStore()
      service = useWorkflowService()
    })

    describe('mode derivation from active workflow', () => {
      it('reflects initialMode of the active workflow', () => {
        const workflow = createModeTestWorkflow({ initialMode: 'app' })
        workflowStore.activeWorkflow = workflow

        expect(appMode.mode.value).toBe('app')
      })

      it('activeMode takes precedence over initialMode', () => {
        const workflow = createModeTestWorkflow({
          initialMode: 'app',
          activeMode: 'graph'
        })
        workflowStore.activeWorkflow = workflow

        expect(appMode.mode.value).toBe('graph')
      })

      it('defaults to graph when no active workflow', () => {
        expect(appMode.mode.value).toBe('graph')
      })

      it('updates when activeWorkflow changes', () => {
        const workflow1 = createModeTestWorkflow({
          path: 'workflows/one.json',
          initialMode: 'app'
        })
        const workflow2 = createModeTestWorkflow({
          path: 'workflows/two.json',
          activeMode: 'builder:inputs'
        })

        workflowStore.activeWorkflow = workflow1
        expect(appMode.mode.value).toBe('app')

        workflowStore.activeWorkflow = workflow2
        expect(appMode.mode.value).toBe('builder:inputs')
      })
    })

    describe('setMode writes to active workflow', () => {
      it('writes activeMode without changing initialMode', () => {
        const workflow = createModeTestWorkflow({ initialMode: 'graph' })
        workflowStore.activeWorkflow = workflow

        appMode.setMode('builder:arrange')

        expect(workflow.activeMode).toBe('builder:arrange')
        expect(workflow.initialMode).toBe('graph')
        expect(appMode.mode.value).toBe('builder:arrange')
      })

      it('sets activeMode even when initialMode already matches', () => {
        const workflow = createModeTestWorkflow({
          initialMode: 'app',
          activeMode: null
        })
        workflowStore.activeWorkflow = workflow

        // mode.value is 'app' via initialMode fallback, but activeMode
        // must still be set so the UI transitions to app view
        appMode.setMode('app')

        expect(workflow.activeMode).toBe('app')
      })
    })

    describe('afterLoadNewGraph initializes initialMode', () => {
      beforeEach(() => {
        mockOpenWorkflow()
      })

      it('sets initialMode from extra.linearMode on first load', async () => {
        const workflow = createModeTestWorkflow({ loaded: false })

        await service.afterLoadNewGraph(
          workflow,
          makeWorkflowData({ linearMode: true })
        )

        expect(workflow.initialMode).toBe('app')
      })

      it('leaves initialMode null when extra.linearMode is absent', async () => {
        const workflow = createModeTestWorkflow({ loaded: false })

        await service.afterLoadNewGraph(workflow, makeWorkflowData())

        expect(workflow.initialMode).toBeNull()
      })

      it('sets initialMode to graph when extra.linearMode is false', async () => {
        const workflow = createModeTestWorkflow({ loaded: false })

        await service.afterLoadNewGraph(
          workflow,
          makeWorkflowData({ linearMode: false })
        )

        expect(workflow.initialMode).toBe('graph')
      })

      it('does not set initialMode on tab switch even if data has linearMode', async () => {
        const workflow = createModeTestWorkflow({ loaded: false })

        // First load — no linearMode in data
        await service.afterLoadNewGraph(workflow, makeWorkflowData())
        expect(workflow.initialMode).toBeNull()

        // User switches to app mode at runtime
        workflow.activeMode = 'app'

        // Tab switch / reload — data now has linearMode (leaked from graph)
        await service.afterLoadNewGraph(
          workflow,
          makeWorkflowData({ linearMode: true })
        )

        // initialMode should NOT have been updated — only builder save sets it
        expect(workflow.initialMode).toBeNull()
      })

      it('preserves existing initialMode on tab switch', async () => {
        const workflow = createModeTestWorkflow({
          initialMode: 'app'
        })

        await service.afterLoadNewGraph(workflow, makeWorkflowData())

        expect(workflow.initialMode).toBe('app')
      })

      it('sets initialMode to app for fresh string-based loads with linearMode', async () => {
        vi.spyOn(workflowStore, 'createNewTemporary').mockReturnValue(
          createModeTestWorkflow()
        )

        await service.afterLoadNewGraph(
          'test.json',
          makeWorkflowData({ linearMode: true })
        )

        expect(appMode.mode.value).toBe('app')
      })

      it('reads initialMode from file when draft lacks linearMode (restoration)', async () => {
        const filePath = 'workflows/saved-app.json'
        const fileInitialState = makeWorkflowData({ linearMode: true })
        const mockTracker = createMockChangeTracker()
        mockTracker.initialState = fileInitialState

        // Persisted, not-loaded workflow in the store
        const persistedWorkflow = new ComfyWorkflowClass({
          path: filePath,
          modified: Date.now(),
          size: 100
        })

        vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(
          persistedWorkflow
        )
        vi.spyOn(workflowStore, 'openWorkflow').mockImplementation(
          async (wf) => {
            wf.changeTracker = mockTracker
            wf.content = JSON.stringify(fileInitialState)
            wf.originalContent = wf.content
            workflowStore.activeWorkflow = wf as LoadedComfyWorkflow
            return wf as LoadedComfyWorkflow
          }
        )

        // Draft data has NO linearMode (simulates rootGraph serialization)
        const draftData = makeWorkflowData()

        await service.afterLoadNewGraph('saved-app.json', draftData)

        // initialMode should come from the file, not the draft
        expect(persistedWorkflow.initialMode).toBe('app')
      })
    })

    describe('round-trip mode preservation', () => {
      it('each workflow retains its own mode across tab switches', () => {
        const workflow1 = createModeTestWorkflow({
          path: 'workflows/one.json',
          activeMode: 'builder:inputs'
        })
        const workflow2 = createModeTestWorkflow({
          path: 'workflows/two.json',
          initialMode: 'app'
        })

        workflowStore.activeWorkflow = workflow1
        expect(appMode.mode.value).toBe('builder:inputs')

        workflowStore.activeWorkflow = workflow2
        expect(appMode.mode.value).toBe('app')

        workflowStore.activeWorkflow = workflow1
        expect(appMode.mode.value).toBe('builder:inputs')
      })
    })
  })

  describe('saveWorkflowAs', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>
    let service: ReturnType<typeof useWorkflowService>

    beforeEach(() => {
      workflowStore = useWorkflowStore()
      service = useWorkflowService()
      vi.spyOn(workflowStore, 'saveWorkflow').mockResolvedValue()
      vi.spyOn(workflowStore, 'renameWorkflow').mockResolvedValue()
      app.rootGraph.extra = {}
    })

    function createTemporaryWorkflow(
      directory: string = 'workflows'
    ): LoadedComfyWorkflow {
      const workflow = new ComfyWorkflowClass({
        path: directory + '/temp.json',
        modified: Date.now(),
        size: 100
      })
      workflow.changeTracker = createMockChangeTracker()
      workflow.content = '{}'
      workflow.originalContent = '{}'
      Object.defineProperty(workflow, 'isTemporary', { get: () => true })
      return workflow as LoadedComfyWorkflow
    }

    it('should rename then save when workflow is temporary', async () => {
      const workflow = createTemporaryWorkflow()
      vi.mocked(workflowStore.getWorkflowByPath).mockReturnValue(null)

      const result = await service.saveWorkflowAs(workflow, {
        filename: 'my-workflow'
      })

      expect(result).toBe(true)
      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/my-workflow.json'
      )
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(workflow)
    })

    it('should return false when no filename is provided', async () => {
      const workflow = createModeTestWorkflow({
        path: 'workflows/test.json'
      })
      vi.spyOn(workflow, 'promptSave').mockResolvedValue(null)

      const result = await service.saveWorkflowAs(workflow)

      expect(result).toBe(false)
      expect(workflowStore.saveWorkflow).not.toHaveBeenCalled()
    })

    it('appends .app.json extension when initialMode is app', async () => {
      const workflow = createTemporaryWorkflow()
      workflow.initialMode = 'app'

      await service.saveWorkflowAs(workflow, { filename: 'my-workflow' })

      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/my-workflow.app.json'
      )
    })

    it('appends .json extension when initialMode is graph', async () => {
      const workflow = createTemporaryWorkflow()
      workflow.initialMode = 'graph'

      await service.saveWorkflowAs(workflow, { filename: 'my-workflow' })

      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/my-workflow.json'
      )
    })

    it('appends .json extension when initialMode is not set', async () => {
      const workflow = createTemporaryWorkflow()

      await service.saveWorkflowAs(workflow, { filename: 'my-workflow' })

      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/my-workflow.json'
      )
    })

    it('uses isApp option over initialMode when provided (graph -> app)', async () => {
      const workflow = createTemporaryWorkflow()
      workflow.initialMode = 'graph'

      await service.saveWorkflowAs(workflow, {
        filename: 'my-workflow',
        isApp: true
      })

      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/my-workflow.app.json'
      )
    })

    it('uses isApp option over initialMode when provided (app -> graph)', async () => {
      const workflow = createTemporaryWorkflow()
      workflow.initialMode = 'app'

      await service.saveWorkflowAs(workflow, {
        filename: 'my-workflow',
        isApp: false
      })

      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/my-workflow.json'
      )
    })

    it('creates a copy when saving same name with different mode (not self-overwrite)', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/test.json',
        initialMode: 'graph'
      })

      const copy = createModeTestWorkflow({
        path: 'workflows/test.app.json'
      })
      vi.spyOn(workflowStore, 'saveAs').mockReturnValue(copy)
      vi.spyOn(workflowStore, 'openWorkflow').mockResolvedValue(copy)

      await service.saveWorkflowAs(source, {
        filename: 'test',
        isApp: true
      })

      // Different extension means different path, so it's not a self-overwrite
      // — a new copy is created instead of modifying the source in place
      expect(source.initialMode).toBe('graph')
      expect(workflowStore.saveAs).toHaveBeenCalledWith(
        source,
        'workflows/test.app.json'
      )
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(copy)
      expect(mockTrackWorkflowSaved).toHaveBeenCalledTimes(1)
      expect(mockTrackWorkflowSaved).toHaveBeenCalledWith({
        is_app: true,
        is_new: true
      })
    })

    it('self-overwrites when saving same name with same mode', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/test.app.json',
        initialMode: 'app'
      })
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(source)
      mockConfirm.mockResolvedValue(true)

      await service.saveWorkflowAs(source, {
        filename: 'test',
        isApp: true
      })

      // Same path → self-overwrite: saves in place via saveWorkflow, no copy
      expect(workflowStore.saveAs).not.toHaveBeenCalled()
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(source)
    })

    it('emits a single is_new:true telemetry event on self-overwrite', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/test.app.json',
        initialMode: 'app'
      })
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(source)
      mockConfirm.mockResolvedValue(true)

      await service.saveWorkflowAs(source, {
        filename: 'test',
        isApp: true
      })

      expect(mockTrackWorkflowSaved).toHaveBeenCalledTimes(1)
      expect(mockTrackWorkflowSaved).toHaveBeenCalledWith({
        is_app: true,
        is_new: true
      })
    })

    it('calls prepareForSave once on self-overwrite', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/test.app.json',
        initialMode: 'app'
      })
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(source)
      mockConfirm.mockResolvedValue(true)

      await service.saveWorkflowAs(source, {
        filename: 'test',
        isApp: true
      })

      expect(source.changeTracker!.prepareForSave).toHaveBeenCalledTimes(1)
    })

    it('does not modify source workflow mode when saving persisted workflow as different mode', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/original.json',
        initialMode: 'graph'
      })

      const copy = createModeTestWorkflow({
        path: 'workflows/copy.app.json'
      })
      vi.spyOn(workflowStore, 'saveAs').mockReturnValue(copy)
      vi.spyOn(workflowStore, 'openWorkflow').mockResolvedValue(copy)

      await service.saveWorkflowAs(source, {
        filename: 'copy',
        isApp: true
      })

      expect(source.initialMode).toBe('graph')
      expect(copy.initialMode).toBe('app')
      expect(workflowStore.saveAs).toHaveBeenCalledWith(
        source,
        'workflows/copy.app.json'
      )
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(copy)
    })

    it('does not modify source workflow mode when saving app as graph', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/original.app.json',
        initialMode: 'app'
      })

      const copy = createModeTestWorkflow({
        path: 'workflows/copy.json'
      })
      vi.spyOn(workflowStore, 'saveAs').mockReturnValue(copy)
      vi.spyOn(workflowStore, 'openWorkflow').mockResolvedValue(copy)

      await service.saveWorkflowAs(source, {
        filename: 'copy',
        isApp: false
      })

      expect(source.initialMode).toBe('app')
      expect(copy.initialMode).toBe('graph')
      expect(workflowStore.saveAs).toHaveBeenCalledWith(
        source,
        'workflows/copy.json'
      )
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(copy)
    })

    function captureLinearModeAtSaveTime() {
      let value: boolean | undefined
      vi.mocked(workflowStore.saveWorkflow).mockImplementation(async () => {
        value = app.rootGraph.extra?.linearMode as boolean | undefined
      })
      return () => value
    }

    it('sets linearMode in graph data before saving (graph -> app)', async () => {
      const workflow = createTemporaryWorkflow()
      workflow.initialMode = 'graph'
      app.rootGraph.extra = { linearMode: false }
      const getLinearMode = captureLinearModeAtSaveTime()

      await service.saveWorkflowAs(workflow, {
        filename: 'my-workflow',
        isApp: true
      })

      expect(getLinearMode()).toBe(true)
    })

    it('sets linearMode in graph data before saving (app -> graph)', async () => {
      const workflow = createTemporaryWorkflow()
      workflow.initialMode = 'app'
      app.rootGraph.extra = { linearMode: true }
      const getLinearMode = captureLinearModeAtSaveTime()

      await service.saveWorkflowAs(workflow, {
        filename: 'my-workflow',
        isApp: false
      })

      expect(getLinearMode()).toBe(false)
    })

    it('sets linearMode before saving persisted workflow copy', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/original.json',
        initialMode: 'graph'
      })
      app.rootGraph.extra = { linearMode: false }

      const copy = createModeTestWorkflow({
        path: 'workflows/original.app.json'
      })
      vi.spyOn(workflowStore, 'saveAs').mockReturnValue(copy)
      vi.spyOn(workflowStore, 'openWorkflow').mockResolvedValue(copy)
      const getLinearMode = captureLinearModeAtSaveTime()

      await service.saveWorkflowAs(source, {
        filename: 'original',
        isApp: true
      })

      expect(getLinearMode()).toBe(true)
    })

    it('does not change initialMode when isApp is omitted (persisted copy)', async () => {
      const source = createModeTestWorkflow({
        path: 'workflows/original.app.json',
        initialMode: 'app'
      })

      // Real saveAs copies initialMode from source; replicate that here
      const copy = createModeTestWorkflow({
        path: 'workflows/copy.app.json',
        initialMode: 'app'
      })
      vi.spyOn(workflowStore, 'saveAs').mockReturnValue(copy)
      vi.spyOn(workflowStore, 'openWorkflow').mockResolvedValue(copy)

      await service.saveWorkflowAs(source, { filename: 'copy' })

      // saveWorkflowAs should not change initialMode when isApp is omitted
      expect(copy.initialMode).toBe('app')
    })
  })

  describe('insertWorkflow', () => {
    it('does not insert while the canvas is picking-only', async () => {
      const workflow = { load: vi.fn() } as unknown as ComfyWorkflow
      Reflect.set(app.canvas, 'selectOnly', true)
      try {
        await useWorkflowService().insertWorkflow(workflow)

        expect(workflow.load).not.toHaveBeenCalled()
      } finally {
        Reflect.set(app.canvas, 'selectOnly', false)
      }
    })

    it('inserts when the canvas is editable', async () => {
      const deserialize = vi.fn()
      Reflect.set(app.canvas, '_deserializeItems', deserialize)
      const workflow = {
        load: vi.fn().mockResolvedValue({
          initialState: { nodes: [], links: [] }
        })
      } as unknown as ComfyWorkflow

      await useWorkflowService().insertWorkflow(workflow)

      expect(workflow.load).toHaveBeenCalledOnce()
      expect(deserialize).toHaveBeenCalledOnce()
    })
  })

  describe('saveWorkflow', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>
    let toastStore: ReturnType<typeof useToastStore>
    let service: ReturnType<typeof useWorkflowService>

    beforeEach(() => {
      workflowStore = useWorkflowStore()
      toastStore = useToastStore()
      service = useWorkflowService()
      vi.spyOn(workflowStore, 'saveWorkflow').mockResolvedValue()
      vi.spyOn(workflowStore, 'renameWorkflow').mockResolvedValue()
    })

    function createSaveableWorkflow(path: string): LoadedComfyWorkflow {
      const workflow = new ComfyWorkflowClass({
        path,
        modified: Date.now(),
        size: 100
      })
      workflow.changeTracker = createMockChangeTracker()
      workflow.content = '{}'
      workflow.originalContent = '{}'
      return workflow as LoadedComfyWorkflow
    }

    it('renames .json to .app.json when initialMode is app', async () => {
      const workflow = createSaveableWorkflow('workflows/test.json')
      workflow.initialMode = 'app'

      await service.saveWorkflow(workflow)

      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/test.app.json'
      )
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(workflow)
    })

    it('renames .app.json to .json when initialMode is graph', async () => {
      const workflow = createSaveableWorkflow('workflows/test.app.json')
      workflow.initialMode = 'graph'

      await service.saveWorkflow(workflow)

      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/test.json'
      )
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(workflow)
    })

    it('does not rename when extension already matches', async () => {
      const workflow = createSaveableWorkflow('workflows/test.app.json')
      workflow.initialMode = 'app'

      await service.saveWorkflow(workflow)

      expect(workflowStore.renameWorkflow).not.toHaveBeenCalled()
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(workflow)
    })

    it('shows toast only when rename occurs', async () => {
      const addSpy = vi.spyOn(toastStore, 'add')

      const workflow = createSaveableWorkflow('workflows/test.json')
      workflow.initialMode = 'app'

      await service.saveWorkflow(workflow)

      expect(addSpy).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'info' })
      )
    })

    it('does not show toast when no rename occurs', async () => {
      const addSpy = vi.spyOn(toastStore, 'add')

      const workflow = createSaveableWorkflow('workflows/test.app.json')
      workflow.initialMode = 'app'

      await service.saveWorkflow(workflow)

      expect(addSpy).not.toHaveBeenCalled()
    })

    it('does not rename when initialMode is not set', async () => {
      const workflow = createSaveableWorkflow('workflows/test.json')

      await service.saveWorkflow(workflow)

      expect(workflowStore.renameWorkflow).not.toHaveBeenCalled()
    })

    it('prompts for overwrite when target path already exists', async () => {
      const workflow = createSaveableWorkflow('workflows/test.json')
      workflow.initialMode = 'app'

      const existing = createSaveableWorkflow('workflows/test.app.json')
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(existing)
      vi.spyOn(workflowStore, 'deleteWorkflow').mockResolvedValue()
      mockConfirm.mockResolvedValue(true)

      await service.saveWorkflow(workflow)

      expect(mockConfirm).toHaveBeenCalled()
      expect(workflowStore.renameWorkflow).toHaveBeenCalledWith(
        workflow,
        'workflows/test.app.json'
      )
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(workflow)
    })

    it('saves without renaming when user declines overwrite', async () => {
      const workflow = createSaveableWorkflow('workflows/test.json')
      workflow.initialMode = 'app'

      const existing = createSaveableWorkflow('workflows/test.app.json')
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(existing)
      mockConfirm.mockResolvedValue(false)

      await service.saveWorkflow(workflow)

      expect(mockConfirm).toHaveBeenCalled()
      expect(workflowStore.renameWorkflow).not.toHaveBeenCalled()
      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(workflow)
    })
  })
})
