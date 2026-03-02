import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDialogService = vi.hoisted(() => ({
  showLayoutDialog: vi.fn()
}))

const mockDialogStore = vi.hoisted(() => ({
  closeDialog: vi.fn()
}))

const mockWorkflowStore = vi.hoisted(() => ({
  activeWorkflow: null as { initialMode?: string | null } | null
}))

const mockSyncLinearMode = vi.hoisted(() => vi.fn())

const mockApp = vi.hoisted(() => ({
  rootGraph: { extra: {} }
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => mockDialogService
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => mockDialogStore
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => mockWorkflowStore
}))

vi.mock('@/platform/workflow/management/stores/comfyWorkflow', () => ({
  syncLinearMode: mockSyncLinearMode
}))

vi.mock('@/scripts/app', () => ({
  app: mockApp
}))

vi.mock('./DefaultViewDialogContent.vue', () => ({
  default: { name: 'MockDefaultViewDialogContent' }
}))

import { useAppSetDefaultView } from './useAppSetDefaultView'

describe('useAppSetDefaultView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkflowStore.activeWorkflow = null
  })

  describe('setSettingView', () => {
    it('opens dialog when set to true', () => {
      const { setSettingView } = useAppSetDefaultView()
      setSettingView(true)

      expect(mockDialogService.showLayoutDialog).toHaveBeenCalledOnce()
    })

    it('does not open dialog when set to false', () => {
      const { setSettingView } = useAppSetDefaultView()
      setSettingView(false)

      expect(mockDialogService.showLayoutDialog).not.toHaveBeenCalled()
    })

    it('resets settingView when set to false', () => {
      const { settingView, setSettingView } = useAppSetDefaultView()
      setSettingView(true)
      expect(settingView.value).toBe(true)

      setSettingView(false)
      expect(settingView.value).toBe(false)
    })
  })

  describe('showDialog', () => {
    it('passes initialOpenAsApp true when initialMode is not graph', () => {
      mockWorkflowStore.activeWorkflow = { initialMode: 'app' }
      const { setSettingView } = useAppSetDefaultView()
      setSettingView(true)

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      expect(call.props.initialOpenAsApp).toBe(true)
    })

    it('passes initialOpenAsApp false when initialMode is graph', () => {
      mockWorkflowStore.activeWorkflow = { initialMode: 'graph' }
      const { setSettingView } = useAppSetDefaultView()
      setSettingView(true)

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      expect(call.props.initialOpenAsApp).toBe(false)
    })

    it('passes initialOpenAsApp true when no active workflow', () => {
      mockWorkflowStore.activeWorkflow = null
      const { setSettingView } = useAppSetDefaultView()
      setSettingView(true)

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      expect(call.props.initialOpenAsApp).toBe(true)
    })
  })

  describe('handleApply', () => {
    it('sets initialMode to app when openAsApp is true', () => {
      const workflow = { initialMode: null as string | null }
      mockWorkflowStore.activeWorkflow = workflow

      const { setSettingView } = useAppSetDefaultView()
      setSettingView(true)

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      call.props.onApply(true)

      expect(workflow.initialMode).toBe('app')
    })

    it('sets initialMode to graph when openAsApp is false', () => {
      const workflow = { initialMode: null as string | null }
      mockWorkflowStore.activeWorkflow = workflow

      const { setSettingView } = useAppSetDefaultView()
      setSettingView(true)

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      call.props.onApply(false)

      expect(workflow.initialMode).toBe('graph')
    })

    it('calls syncLinearMode with workflow and rootGraph', () => {
      const workflow = { initialMode: null as string | null }
      mockWorkflowStore.activeWorkflow = workflow

      const { setSettingView } = useAppSetDefaultView()
      setSettingView(true)

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      call.props.onApply(true)

      expect(mockSyncLinearMode).toHaveBeenCalledWith(workflow, [
        mockApp.rootGraph
      ])
    })

    it('closes dialog after applying', () => {
      mockWorkflowStore.activeWorkflow = { initialMode: null }

      const { settingView, setSettingView } = useAppSetDefaultView()
      setSettingView(true)

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      call.props.onApply(true)

      expect(mockDialogStore.closeDialog).toHaveBeenCalledWith({
        key: 'builder-default-view'
      })
      expect(settingView.value).toBe(false)
    })

    it('does nothing when no active workflow', () => {
      mockWorkflowStore.activeWorkflow = null

      const { setSettingView } = useAppSetDefaultView()
      setSettingView(true)

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      call.props.onApply(true)

      expect(mockSyncLinearMode).not.toHaveBeenCalled()
    })
  })
})
