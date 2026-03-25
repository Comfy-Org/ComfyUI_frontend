import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const mockSetMode = vi.hoisted(() => vi.fn())
const mockToastErrorHandler = vi.hoisted(() => vi.fn())
const mockTrackEnterLinear = vi.hoisted(() => vi.fn())
const mockSaveWorkflow = vi.hoisted(() => vi.fn<() => Promise<void>>())
const mockSaveWorkflowAs = vi.hoisted(() =>
  vi.fn<() => Promise<boolean | null>>()
)
const mockShowLayoutDialog = vi.hoisted(() => vi.fn())
const mockShowConfirmDialog = vi.hoisted(() => vi.fn())
const mockCloseDialog = vi.hoisted(() => vi.fn())
const mockSetWorkflowDefaultView = vi.hoisted(() => vi.fn())
const mockExitBuilder = vi.hoisted(() => vi.fn())

const mockActiveWorkflow = ref<{
  filename: string
  initialMode?: string | null
} | null>(null)

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({ setMode: mockSetMode })
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({ toastErrorHandler: mockToastErrorHandler })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackEnterLinear: mockTrackEnterLinear })
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({
    saveWorkflow: mockSaveWorkflow,
    saveWorkflowAs: mockSaveWorkflowAs
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get activeWorkflow() {
      return mockActiveWorkflow.value
    }
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ showLayoutDialog: mockShowLayoutDialog })
}))

vi.mock('@/stores/appModeStore', () => ({
  useAppModeStore: () => ({ exitBuilder: mockExitBuilder })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ closeDialog: mockCloseDialog })
}))

vi.mock('./builderViewOptions', () => ({
  setWorkflowDefaultView: mockSetWorkflowDefaultView
}))

vi.mock('@/components/dialog/confirm/confirmDialog', () => ({
  showConfirmDialog: mockShowConfirmDialog
}))

vi.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, string>) => {
    if (params) return `${key}:${JSON.stringify(params)}`
    return key
  }
}))

vi.mock('./BuilderSaveDialogContent.vue', () => ({
  default: { template: '<div />' }
}))

const SAVE_DIALOG_KEY = 'builder-save'
const SUCCESS_DIALOG_KEY = 'builder-save-success'

async function importComposable() {
  const { useBuilderSave } = await import('./useBuilderSave')
  return useBuilderSave()
}

describe('useBuilderSave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveWorkflow.value = null
  })

  describe('save()', () => {
    it('does nothing when there is no active workflow', async () => {
      mockActiveWorkflow.value = null
      const { save } = await importComposable()

      await save()

      expect(mockSaveWorkflow).not.toHaveBeenCalled()
    })

    it('saves workflow directly and shows success dialog', async () => {
      mockActiveWorkflow.value = { filename: 'my-workflow', initialMode: 'app' }
      mockSaveWorkflow.mockResolvedValueOnce(undefined)
      const { save } = await importComposable()

      await save()

      expect(mockSaveWorkflow).toHaveBeenCalledOnce()
      expect(mockShowConfirmDialog).toHaveBeenCalledOnce()
      const successCall = mockShowConfirmDialog.mock.calls[0][0]
      expect(successCall.key).toBe(SUCCESS_DIALOG_KEY)
      expect(successCall.props.promptText).toBe('builderSave.successBody')
    })

    it('toasts error on failure', async () => {
      mockActiveWorkflow.value = { filename: 'my-workflow', initialMode: 'app' }
      const error = new Error('save failed')
      mockSaveWorkflow.mockRejectedValueOnce(error)
      const { save } = await importComposable()

      await save()

      expect(mockToastErrorHandler).toHaveBeenCalledWith(error)
      expect(mockShowConfirmDialog).not.toHaveBeenCalled()
    })
  })

  describe('saveAs()', () => {
    it('does nothing when there is no active workflow', async () => {
      mockActiveWorkflow.value = null
      const { saveAs } = await importComposable()

      saveAs()

      expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    })

    it('opens save dialog with correct defaultFilename and defaultOpenAsApp', async () => {
      mockActiveWorkflow.value = { filename: 'my-workflow', initialMode: 'app' }
      const { saveAs } = await importComposable()

      saveAs()

      expect(mockShowLayoutDialog).toHaveBeenCalledOnce()
      const { key, props } = mockShowLayoutDialog.mock.calls[0][0]
      expect(key).toBe(SAVE_DIALOG_KEY)
      expect(props.defaultFilename).toBe('my-workflow')
      expect(props.defaultOpenAsApp).toBe(true)
    })

    it('passes defaultOpenAsApp: false when initialMode is graph', async () => {
      mockActiveWorkflow.value = {
        filename: 'my-workflow',
        initialMode: 'graph'
      }
      const { saveAs } = await importComposable()

      saveAs()

      const { props } = mockShowLayoutDialog.mock.calls[0][0]
      expect(props.defaultOpenAsApp).toBe(false)
    })
  })

  describe('save dialog callbacks', () => {
    async function getSaveDialogProps() {
      mockActiveWorkflow.value = { filename: 'my-workflow', initialMode: 'app' }
      const { saveAs } = await importComposable()
      saveAs()
      return mockShowLayoutDialog.mock.calls[0][0].props as {
        onSave: (filename: string, openAsApp: boolean) => Promise<void>
        onClose: () => void
      }
    }

    it('onSave calls saveWorkflowAs then setWorkflowDefaultView on success', async () => {
      mockSaveWorkflowAs.mockResolvedValueOnce(true)
      const { onSave } = await getSaveDialogProps()

      await onSave('new-name', true)

      expect(mockSaveWorkflowAs).toHaveBeenCalledWith(
        mockActiveWorkflow.value,
        {
          filename: 'new-name'
        }
      )
      expect(mockSetWorkflowDefaultView).toHaveBeenCalledWith(
        mockActiveWorkflow.value,
        true
      )
    })

    it('onSave does not mutate or close when saveWorkflowAs returns falsy', async () => {
      mockSaveWorkflowAs.mockResolvedValueOnce(null)
      const { onSave } = await getSaveDialogProps()

      await onSave('new-name', false)

      expect(mockSetWorkflowDefaultView).not.toHaveBeenCalled()
      expect(mockCloseDialog).not.toHaveBeenCalled()
    })

    it('onSave closes dialog and shows success dialog after successful save', async () => {
      mockSaveWorkflowAs.mockResolvedValueOnce(true)
      const { onSave } = await getSaveDialogProps()

      await onSave('new-name', true)

      expect(mockCloseDialog).toHaveBeenCalledWith({ key: SAVE_DIALOG_KEY })
      expect(mockShowConfirmDialog).toHaveBeenCalledOnce()
      const successCall = mockShowConfirmDialog.mock.calls[0][0]
      expect(successCall.key).toBe(SUCCESS_DIALOG_KEY)
    })

    it('shows app success message when openAsApp is true', async () => {
      mockSaveWorkflowAs.mockResolvedValueOnce(true)
      const { onSave } = await getSaveDialogProps()

      await onSave('new-name', true)

      const successCall = mockShowConfirmDialog.mock.calls[0][0]
      expect(successCall.props.promptText).toBe('builderSave.successBodyApp')
    })

    it('shows graph success message with exit builder button when openAsApp is false', async () => {
      mockSaveWorkflowAs.mockResolvedValueOnce(true)
      const { onSave } = await getSaveDialogProps()

      await onSave('new-name', false)

      const successCall = mockShowConfirmDialog.mock.calls[0][0]
      expect(successCall.props.promptText).toBe('builderSave.successBodyGraph')
      expect(successCall.footerProps.confirmText).toBe(
        'linearMode.builder.exit'
      )
      expect(successCall.footerProps.cancelText).toBe('builderToolbar.viewApp')
    })

    it('onSave toasts error and closes dialog on failure', async () => {
      const error = new Error('save-as failed')
      mockSaveWorkflowAs.mockRejectedValueOnce(error)
      const { onSave } = await getSaveDialogProps()

      await onSave('new-name', false)

      expect(mockToastErrorHandler).toHaveBeenCalledWith(error)
      expect(mockCloseDialog).toHaveBeenCalledWith({ key: SAVE_DIALOG_KEY })
    })
  })

  describe('showSuccessDialog callbacks', () => {
    async function getSuccessDialogProps() {
      mockActiveWorkflow.value = { filename: 'my-workflow', initialMode: 'app' }
      mockSaveWorkflow.mockResolvedValueOnce(undefined)
      const { save } = await importComposable()
      await save()
      return mockShowConfirmDialog.mock.calls[0][0].footerProps as {
        onConfirm: () => void
        onCancel: () => void
      }
    }

    it('onConfirm closes dialog, tracks telemetry, and sets mode to app', async () => {
      const { onConfirm } = await getSuccessDialogProps()

      onConfirm()

      expect(mockCloseDialog).toHaveBeenCalledWith({ key: SUCCESS_DIALOG_KEY })
      expect(mockTrackEnterLinear).toHaveBeenCalledWith({
        source: 'app_builder'
      })
      expect(mockSetMode).toHaveBeenCalledWith('app')
    })

    it('onCancel closes success dialog', async () => {
      const { onCancel } = await getSuccessDialogProps()

      onCancel()

      expect(mockCloseDialog).toHaveBeenCalledWith({ key: SUCCESS_DIALOG_KEY })
    })
  })

  describe('graph success dialog callbacks', () => {
    async function getGraphSuccessDialogProps() {
      mockActiveWorkflow.value = { filename: 'my-workflow', initialMode: 'app' }
      mockSaveWorkflowAs.mockResolvedValueOnce(true)
      const { saveAs } = await importComposable()
      saveAs()
      const { onSave } = mockShowLayoutDialog.mock.calls[0][0].props as {
        onSave: (filename: string, openAsApp: boolean) => Promise<void>
      }
      await onSave('new-name', false)
      return mockShowConfirmDialog.mock.calls[0][0].footerProps as {
        onConfirm: () => void
        onCancel: () => void
      }
    }

    it('onConfirm closes dialog and exits builder', async () => {
      const { onConfirm } = await getGraphSuccessDialogProps()

      onConfirm()

      expect(mockCloseDialog).toHaveBeenCalledWith({ key: SUCCESS_DIALOG_KEY })
      expect(mockExitBuilder).toHaveBeenCalledOnce()
    })

    it('onCancel closes dialog and switches to app mode', async () => {
      const { onCancel } = await getGraphSuccessDialogProps()

      onCancel()

      expect(mockCloseDialog).toHaveBeenCalledWith({ key: SUCCESS_DIALOG_KEY })
      expect(mockTrackEnterLinear).toHaveBeenCalledWith({
        source: 'app_builder'
      })
      expect(mockSetMode).toHaveBeenCalledWith('app')
    })
  })
})
