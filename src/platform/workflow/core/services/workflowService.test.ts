import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  LoadedComfyWorkflow,
  PendingWarnings
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { ComfyWorkflow as ComfyWorkflowClass } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { app } from '@/scripts/app'
import { useAppMode } from '@/composables/useAppMode'
import type { AppMode } from '@/composables/useAppMode'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { createMockChangeTracker } from '@/utils/__tests__/litegraphTestUtils'

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

const { mockConfirm } = vi.hoisted(() => ({
  mockConfirm: vi.fn()
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
    loadGraphData: vi.fn()
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

vi.mock('@/platform/workflow/persistence/stores/workflowDraftStore', () => ({
  useWorkflowDraftStore: () => ({
    saveDraft: vi.fn(),
    getDraft: vi.fn(),
    removeDraft: vi.fn(),
    markDraftUsed: vi.fn()
  })
}))

vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({
    clear: vi.fn()
  })
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
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
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
  })

  describe('openWorkflow deferred warnings', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>

    beforeEach(() => {
      enableWarningSettings()
      workflowStore = useWorkflowStore()
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, wf) => {
          workflowStore.activeWorkflow = wf as LoadedComfyWorkflow
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

      await useWorkflowService().saveWorkflow(workflow)

      expect(workflowStore.saveWorkflow).toHaveBeenCalledWith(workflow)
    })

    it('should call saveWorkflowAs for temporary workflows', async () => {
      const workflow = createModeTestWorkflow({
        path: 'workflows/Unsaved Workflow.json'
      })
      Object.defineProperty(workflow, 'isTemporary', { get: () => true })
      vi.spyOn(workflow, 'promptSave').mockResolvedValue(null)

      await useWorkflowService().saveWorkflow(workflow)

      expect(workflowStore.saveWorkflow).not.toHaveBeenCalled()
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
    })

    it('should reuse the active workflow when loading the same path repeatedly', async () => {
      const workflowId = 'repeat-workflow-id'
      existingWorkflow.changeTracker.activeState.id = workflowId

      await useWorkflowService().afterLoadNewGraph('repeat', {
        id: workflowId,
        nodes: [{ id: 1, type: 'TestNode', pos: [0, 0], size: [100, 100] }]
      } as never)

      expect(workflowStore.getWorkflowByPath).toHaveBeenCalledWith(
        'workflows/repeat.json'
      )
      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalled()
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
      expect(workflowStore.createNewTemporary).not.toHaveBeenCalled()
    })

    it('should reuse active workflow for repeated same-path loads without ids', async () => {
      await useWorkflowService().afterLoadNewGraph('repeat', {
        nodes: [{ id: 1, type: 'TestNode', pos: [0, 0], size: [100, 100] }]
      } as never)

      expect(workflowStore.getWorkflowByPath).toHaveBeenCalledWith(
        'workflows/repeat.json'
      )
      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalled()
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
      expect(workflowStore.createNewTemporary).not.toHaveBeenCalled()
    })

    it('should reuse active workflow when only one side has an id', async () => {
      existingWorkflow.changeTracker.activeState.id = 'existing-id'

      await useWorkflowService().afterLoadNewGraph('repeat', {
        nodes: [{ id: 1, type: 'TestNode', pos: [0, 0], size: [100, 100] }]
      } as never)

      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalled()
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
      expect(workflowStore.createNewTemporary).not.toHaveBeenCalled()
    })

    it('should reuse active workflow when only workflowData has an id', async () => {
      await useWorkflowService().afterLoadNewGraph('repeat', {
        id: 'incoming-id',
        nodes: [{ id: 1, type: 'TestNode', pos: [0, 0], size: [100, 100] }]
      } as never)

      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(existingWorkflow.changeTracker.reset).toHaveBeenCalled()
      expect(existingWorkflow.changeTracker.restore).toHaveBeenCalled()
      expect(workflowStore.createNewTemporary).not.toHaveBeenCalled()
    })

    it('should create new temporary when ids differ', async () => {
      existingWorkflow.changeTracker.activeState.id = 'existing-id'

      const tempWorkflow = createModeTestWorkflow({
        path: 'workflows/repeat (2).json'
      })
      vi.mocked(workflowStore.createNewTemporary).mockReturnValue(tempWorkflow)
      vi.mocked(workflowStore.openWorkflow).mockResolvedValue(tempWorkflow)

      await useWorkflowService().afterLoadNewGraph('repeat', {
        id: 'different-id',
        nodes: [{ id: 1, type: 'TestNode', pos: [0, 0], size: [100, 100] }]
      } as never)

      expect(workflowStore.createNewTemporary).toHaveBeenCalled()
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
