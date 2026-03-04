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

const { mockShowMissingNodes, mockShowMissingModels, mockConfirm } = vi.hoisted(
  () => ({
    mockShowMissingNodes: vi.fn(),
    mockShowMissingModels: vi.fn(),
    mockConfirm: vi.fn()
  })
)

vi.mock('@/composables/useMissingNodesDialog', () => ({
  useMissingNodesDialog: () => ({ show: mockShowMissingNodes, hide: vi.fn() })
}))

vi.mock('@/composables/useMissingModelsDialog', () => ({
  useMissingModelsDialog: () => ({ show: mockShowMissingModels, hide: vi.fn() })
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
    rootGraph: { serialize: vi.fn(() => ({})) },
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
  useTelemetry: () => null
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

const MISSING_MODELS: PendingWarnings['missingModels'] = {
  missingModels: [
    { name: 'model.safetensors', url: '', directory: 'checkpoints' }
  ],
  paths: { checkpoints: ['/models/checkpoints'] }
}

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
      if (key === 'Comfy.Workflow.ShowMissingNodesWarning') return true
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

    it('should do nothing when workflow has no pending warnings', () => {
      const workflow = createWorkflow(null)
      useWorkflowService().showPendingWarnings(workflow)

      expect(mockShowMissingNodes).not.toHaveBeenCalled()
      expect(mockShowMissingModels).not.toHaveBeenCalled()
    })

    it('should show missing nodes dialog and clear warnings', () => {
      const missingNodeTypes = ['CustomNode1', 'CustomNode2']
      const workflow = createWorkflow({ missingNodeTypes })

      useWorkflowService().showPendingWarnings(workflow)

      expect(mockShowMissingNodes).toHaveBeenCalledWith({
        missingNodeTypes
      })
      expect(workflow.pendingWarnings).toBeNull()
    })

    it('should show missing models dialog and clear warnings', () => {
      const workflow = createWorkflow({ missingModels: MISSING_MODELS })

      useWorkflowService().showPendingWarnings(workflow)

      expect(mockShowMissingModels).toHaveBeenCalledWith(MISSING_MODELS)
      expect(workflow.pendingWarnings).toBeNull()
    })

    it('should not show dialogs when settings are disabled', () => {
      vi.spyOn(useSettingStore(), 'get').mockReturnValue(false)

      const workflow = createWorkflow({
        missingNodeTypes: ['CustomNode1'],
        missingModels: MISSING_MODELS
      })

      useWorkflowService().showPendingWarnings(workflow)

      expect(mockShowMissingNodes).not.toHaveBeenCalled()
      expect(mockShowMissingModels).not.toHaveBeenCalled()
      expect(workflow.pendingWarnings).toBeNull()
    })

    it('should only show warnings once across multiple calls', () => {
      const workflow = createWorkflow({
        missingNodeTypes: ['CustomNode1']
      })

      const service = useWorkflowService()
      service.showPendingWarnings(workflow)
      service.showPendingWarnings(workflow)

      expect(mockShowMissingNodes).toHaveBeenCalledTimes(1)
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

      expect(mockShowMissingNodes).not.toHaveBeenCalled()

      await useWorkflowService().openWorkflow(workflow)

      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.anything(),
        true,
        true,
        workflow,
        expect.objectContaining({ deferWarnings: true })
      )
      expect(mockShowMissingNodes).toHaveBeenCalledWith({
        missingNodeTypes: ['CustomNode1']
      })
      expect(workflow.pendingWarnings).toBeNull()
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
      expect(mockShowMissingNodes).toHaveBeenCalledTimes(1)
      expect(mockShowMissingNodes).toHaveBeenCalledWith({
        missingNodeTypes: ['MissingNodeA']
      })
      expect(workflow1.pendingWarnings).toBeNull()
      expect(workflow2.pendingWarnings).not.toBeNull()

      await service.openWorkflow(workflow2)
      expect(mockShowMissingNodes).toHaveBeenCalledTimes(2)
      expect(mockShowMissingNodes).toHaveBeenLastCalledWith({
        missingNodeTypes: ['MissingNodeB']
      })
      expect(workflow2.pendingWarnings).toBeNull()
    })

    it('should not show warnings when refocusing a cleared tab', async () => {
      const workflow = createWorkflow(
        { missingNodeTypes: ['CustomNode1'] },
        { loadable: true }
      )

      const service = useWorkflowService()

      await service.openWorkflow(workflow, { force: true })
      expect(mockShowMissingNodes).toHaveBeenCalledTimes(1)

      await service.openWorkflow(workflow, { force: true })
      expect(mockShowMissingNodes).toHaveBeenCalledTimes(1)
    })
  })

  describe('afterLoadNewGraph', () => {
    it('should reuse the active workflow when loading the same path repeatedly', async () => {
      const reset = vi.fn()
      const restore = vi.fn()
      const existingWorkflow = {
        path: 'workflows/repeat.json',
        isPersisted: true,
        isLoaded: true,
        activeState: {
          id: 'same-id'
        },
        changeTracker: {
          reset,
          restore
        }
      } as unknown as ComfyWorkflow

      const workflowStore = useWorkflowStore()
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(
        existingWorkflow
      )
      vi.spyOn(workflowStore, 'isActive').mockReturnValue(true)
      vi.spyOn(workflowStore, 'openWorkflow').mockResolvedValue(
        existingWorkflow as LoadedComfyWorkflow
      )
      const createNewTemporarySpy = vi.spyOn(
        workflowStore,
        'createNewTemporary'
      )

      await useWorkflowService().afterLoadNewGraph('repeat', {
        id: 'same-id',
        nodes: [{ id: 1, type: 'TestNode', pos: [0, 0], size: [100, 100] }]
      } as never)

      expect(workflowStore.getWorkflowByPath).toHaveBeenCalledWith(
        'workflows/repeat.json'
      )
      expect(workflowStore.openWorkflow).toHaveBeenCalledWith(existingWorkflow)
      expect(reset).toHaveBeenCalled()
      expect(restore).toHaveBeenCalled()
      expect(createNewTemporarySpy).not.toHaveBeenCalled()
    })

    it('should create a new temporary workflow when active workflow id differs', async () => {
      const existingWorkflow = {
        path: 'workflows/repeat.json',
        isPersisted: true,
        isLoaded: true,
        activeState: {
          id: 'active-id'
        }
      } as unknown as ComfyWorkflow

      const workflowStore = useWorkflowStore()
      vi.spyOn(workflowStore, 'getWorkflowByPath').mockReturnValue(
        existingWorkflow
      )
      vi.spyOn(workflowStore, 'isActive').mockReturnValue(true)
      const openWorkflowSpy = vi
        .spyOn(workflowStore, 'openWorkflow')
        .mockResolvedValue(existingWorkflow as LoadedComfyWorkflow)
      const createNewTemporarySpy = vi
        .spyOn(workflowStore, 'createNewTemporary')
        .mockReturnValue(existingWorkflow)

      await useWorkflowService().afterLoadNewGraph('repeat', {
        id: 'incoming-id',
        nodes: [{ id: 1, type: 'TestNode', pos: [0, 0], size: [100, 100] }]
      } as never)

      expect(createNewTemporarySpy).toHaveBeenCalled()
      expect(openWorkflowSpy).toHaveBeenCalledWith(existingWorkflow)
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
          activeMode: 'builder:select'
        })

        workflowStore.activeWorkflow = workflow1
        expect(appMode.mode.value).toBe('app')

        workflowStore.activeWorkflow = workflow2
        expect(appMode.mode.value).toBe('builder:select')
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
          activeMode: 'builder:select'
        })
        const workflow2 = createModeTestWorkflow({
          path: 'workflows/two.json',
          initialMode: 'app'
        })

        workflowStore.activeWorkflow = workflow1
        expect(appMode.mode.value).toBe('builder:select')

        workflowStore.activeWorkflow = workflow2
        expect(appMode.mode.value).toBe('app')

        workflowStore.activeWorkflow = workflow1
        expect(appMode.mode.value).toBe('builder:select')
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
