import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDialogService = vi.hoisted(() => ({
  showLayoutDialog: vi.fn()
}))

const mockDialogStore = vi.hoisted(() => ({
  closeDialog: vi.fn(),
  isDialogOpen: vi.fn<(key: string) => boolean>().mockReturnValue(false)
}))

const mockWorkflowStore = vi.hoisted(() => ({
  activeWorkflow: null as {
    initialMode?: string | null
    changeTracker?: { checkState: () => void }
  } | null
}))

const mockApp = vi.hoisted(() => ({
  rootGraph: { extra: {} as Record<string, unknown> }
}))

const mockSetMode = vi.hoisted(() => vi.fn())

const mockAppModeStore = vi.hoisted(() => ({
  exitBuilder: vi.fn()
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

vi.mock('@/scripts/app', () => ({
  app: mockApp
}))

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({ setMode: mockSetMode })
}))

vi.mock('@/stores/appModeStore', () => ({
  useAppModeStore: () => mockAppModeStore
}))

vi.mock('./DefaultViewDialogContent.vue', () => ({
  default: { name: 'MockDefaultViewDialogContent' }
}))

vi.mock('./BuilderDefaultModeAppliedDialogContent.vue', () => ({
  default: { name: 'MockBuilderDefaultModeAppliedDialogContent' }
}))

import { useAppSetDefaultView } from './useAppSetDefaultView'

describe('useAppSetDefaultView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkflowStore.activeWorkflow = null
    mockApp.rootGraph.extra = {}
  })

  describe('settingView', () => {
    it('reflects dialogStore.isDialogOpen', () => {
      mockDialogStore.isDialogOpen.mockReturnValue(true)
      const { settingView } = useAppSetDefaultView()
      expect(settingView.value).toBe(true)
    })
  })

  describe('showDialog', () => {
    it('opens dialog via dialogService', () => {
      const { showDialog } = useAppSetDefaultView()
      showDialog()

      expect(mockDialogService.showLayoutDialog).toHaveBeenCalledOnce()
    })

    it('passes initialOpenAsApp true when initialMode is not graph', () => {
      mockWorkflowStore.activeWorkflow = { initialMode: 'app' }
      const { showDialog } = useAppSetDefaultView()
      showDialog()

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      expect(call.props.initialOpenAsApp).toBe(true)
    })

    it('passes initialOpenAsApp false when initialMode is graph', () => {
      mockWorkflowStore.activeWorkflow = { initialMode: 'graph' }
      const { showDialog } = useAppSetDefaultView()
      showDialog()

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      expect(call.props.initialOpenAsApp).toBe(false)
    })

    it('passes initialOpenAsApp true when no active workflow', () => {
      mockWorkflowStore.activeWorkflow = null
      const { showDialog } = useAppSetDefaultView()
      showDialog()

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      expect(call.props.initialOpenAsApp).toBe(true)
    })
  })

  describe('handleApply', () => {
    it('sets initialMode to app when openAsApp is true', () => {
      const workflow = { initialMode: null as string | null }
      mockWorkflowStore.activeWorkflow = workflow

      const { showDialog } = useAppSetDefaultView()
      showDialog()

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      call.props.onApply(true)

      expect(workflow.initialMode).toBe('app')
    })

    it('sets initialMode to graph when openAsApp is false', () => {
      const workflow = { initialMode: null as string | null }
      mockWorkflowStore.activeWorkflow = workflow

      const { showDialog } = useAppSetDefaultView()
      showDialog()

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      call.props.onApply(false)

      expect(workflow.initialMode).toBe('graph')
    })

    it('sets linearMode on rootGraph.extra', () => {
      mockWorkflowStore.activeWorkflow = { initialMode: null }

      const { showDialog } = useAppSetDefaultView()
      showDialog()

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      call.props.onApply(true)

      expect(mockApp.rootGraph.extra.linearMode).toBe(true)
    })

    it('closes dialog after applying', () => {
      mockWorkflowStore.activeWorkflow = { initialMode: null }

      const { showDialog } = useAppSetDefaultView()
      showDialog()

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      call.props.onApply(true)

      expect(mockDialogStore.closeDialog).toHaveBeenCalledWith({
        key: 'builder-default-view'
      })
    })

    it('shows confirmation dialog after applying', () => {
      mockWorkflowStore.activeWorkflow = { initialMode: null }

      const { showDialog } = useAppSetDefaultView()
      showDialog()

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      call.props.onApply(true)

      expect(mockDialogService.showLayoutDialog).toHaveBeenCalledTimes(2)
      const confirmCall = mockDialogService.showLayoutDialog.mock.calls[1][0]
      expect(confirmCall.key).toBe('builder-default-view-applied')
      expect(confirmCall.props.appliedAsApp).toBe(true)
    })

    it('passes appliedAsApp false to confirmation dialog when graph', () => {
      mockWorkflowStore.activeWorkflow = { initialMode: null }

      const { showDialog } = useAppSetDefaultView()
      showDialog()

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      call.props.onApply(false)

      const confirmCall = mockDialogService.showLayoutDialog.mock.calls[1][0]
      expect(confirmCall.props.appliedAsApp).toBe(false)
    })
  })

  describe('applied dialog', () => {
    function applyAndGetConfirmDialog(openAsApp: boolean) {
      mockWorkflowStore.activeWorkflow = { initialMode: null }

      const { showDialog } = useAppSetDefaultView()
      showDialog()

      const applyCall = mockDialogService.showLayoutDialog.mock.calls[0][0]
      applyCall.props.onApply(openAsApp)

      return mockDialogService.showLayoutDialog.mock.calls[1][0]
    }

    it('onViewApp sets mode to app and closes dialog', () => {
      const confirmCall = applyAndGetConfirmDialog(true)
      confirmCall.props.onViewApp()

      expect(mockDialogStore.closeDialog).toHaveBeenCalledWith({
        key: 'builder-default-view-applied'
      })
      expect(mockSetMode).toHaveBeenCalledWith('app')
    })

    it('onExitToWorkflow exits builder and closes dialog', () => {
      const confirmCall = applyAndGetConfirmDialog(true)
      confirmCall.props.onExitToWorkflow()

      expect(mockDialogStore.closeDialog).toHaveBeenCalledWith({
        key: 'builder-default-view-applied'
      })
      expect(mockAppModeStore.exitBuilder).toHaveBeenCalledOnce()
    })

    it('onClose closes confirmation dialog', () => {
      const confirmCall = applyAndGetConfirmDialog(true)

      mockDialogStore.closeDialog.mockClear()
      confirmCall.props.onClose()

      expect(mockDialogStore.closeDialog).toHaveBeenCalledWith({
        key: 'builder-default-view-applied'
      })
    })
  })
})
