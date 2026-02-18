import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PendingWarnings } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { app } from '@/scripts/app'

const { mockShowLoadWorkflowWarning, mockShowMissingModelsWarning } =
  vi.hoisted(() => ({
    mockShowLoadWorkflowWarning: vi.fn(),
    mockShowMissingModelsWarning: vi.fn()
  }))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showLoadWorkflowWarning: mockShowLoadWorkflowWarning,
    showMissingModelsWarning: mockShowMissingModelsWarning,
    prompt: vi.fn(),
    confirm: vi.fn()
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
  return {
    pendingWarnings: warnings,
    ...(options.loadable && {
      path: options.path ?? 'workflows/test.json',
      isLoaded: true,
      activeState: { nodes: [], links: [] },
      changeTracker: { reset: vi.fn(), restore: vi.fn() }
    })
  } as unknown as ComfyWorkflow
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

      expect(mockShowLoadWorkflowWarning).not.toHaveBeenCalled()
      expect(mockShowMissingModelsWarning).not.toHaveBeenCalled()
    })

    it('should show missing nodes dialog and clear warnings', () => {
      const missingNodeTypes = ['CustomNode1', 'CustomNode2']
      const workflow = createWorkflow({ missingNodeTypes })

      useWorkflowService().showPendingWarnings(workflow)

      expect(mockShowLoadWorkflowWarning).toHaveBeenCalledWith({
        missingNodeTypes
      })
      expect(workflow.pendingWarnings).toBeNull()
    })

    it('should show missing models dialog and clear warnings', () => {
      const workflow = createWorkflow({ missingModels: MISSING_MODELS })

      useWorkflowService().showPendingWarnings(workflow)

      expect(mockShowMissingModelsWarning).toHaveBeenCalledWith(MISSING_MODELS)
      expect(workflow.pendingWarnings).toBeNull()
    })

    it('should not show dialogs when settings are disabled', () => {
      vi.spyOn(useSettingStore(), 'get').mockReturnValue(false)

      const workflow = createWorkflow({
        missingNodeTypes: ['CustomNode1'],
        missingModels: MISSING_MODELS
      })

      useWorkflowService().showPendingWarnings(workflow)

      expect(mockShowLoadWorkflowWarning).not.toHaveBeenCalled()
      expect(mockShowMissingModelsWarning).not.toHaveBeenCalled()
      expect(workflow.pendingWarnings).toBeNull()
    })

    it('should only show warnings once across multiple calls', () => {
      const workflow = createWorkflow({
        missingNodeTypes: ['CustomNode1']
      })

      const service = useWorkflowService()
      service.showPendingWarnings(workflow)
      service.showPendingWarnings(workflow)

      expect(mockShowLoadWorkflowWarning).toHaveBeenCalledTimes(1)
    })
  })

  describe('openWorkflow deferred warnings', () => {
    let workflowStore: ReturnType<typeof useWorkflowStore>

    beforeEach(() => {
      enableWarningSettings()
      workflowStore = useWorkflowStore()
      vi.mocked(app.loadGraphData).mockImplementation(
        async (_data, _clean, _restore, wf) => {
          ;(
            workflowStore as unknown as Record<string, unknown>
          ).activeWorkflow = wf
        }
      )
    })

    it('should defer warnings during load and show on focus', async () => {
      const workflow = createWorkflow(
        { missingNodeTypes: ['CustomNode1'] },
        { loadable: true }
      )

      expect(mockShowLoadWorkflowWarning).not.toHaveBeenCalled()

      await useWorkflowService().openWorkflow(workflow)

      expect(app.loadGraphData).toHaveBeenCalledWith(
        expect.anything(),
        true,
        true,
        workflow,
        expect.objectContaining({ deferWarnings: true })
      )
      expect(mockShowLoadWorkflowWarning).toHaveBeenCalledWith({
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
      expect(mockShowLoadWorkflowWarning).toHaveBeenCalledTimes(1)
      expect(mockShowLoadWorkflowWarning).toHaveBeenCalledWith({
        missingNodeTypes: ['MissingNodeA']
      })
      expect(workflow1.pendingWarnings).toBeNull()
      expect(workflow2.pendingWarnings).not.toBeNull()

      await service.openWorkflow(workflow2)
      expect(mockShowLoadWorkflowWarning).toHaveBeenCalledTimes(2)
      expect(mockShowLoadWorkflowWarning).toHaveBeenLastCalledWith({
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
      expect(mockShowLoadWorkflowWarning).toHaveBeenCalledTimes(1)

      await service.openWorkflow(workflow, { force: true })
      expect(mockShowLoadWorkflowWarning).toHaveBeenCalledTimes(1)
    })
  })
})
