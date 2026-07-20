import { beforeEach, describe, expect, it, vi } from 'vitest'

type ActiveWorkflow = {
  initialMode: string
  changeTracker?: {
    activeState?: {
      extra?: {
        linearData?: unknown
      }
    }
  }
}

type ConfirmDialogOptions = {
  footerProps?: {
    onCancel?: () => void
    onConfirm?: () => void
  }
}

type ShareDialogOptions = {
  props?: {
    onClose?: () => void
  }
}

const mocks = vi.hoisted(() => ({
  closeDialog: vi.fn(),
  pruneLinearData: vi.fn(),
  shareFlowContext: {
    value: {
      source: 'graph_mode',
      view_mode: 'default',
      is_app_mode: false
    }
  },
  showConfirmDialog: vi.fn((..._args: unknown[]) => 'confirm-dialog'),
  showLayoutDialog: vi.fn(),
  telemetry: {
    value: {
      trackShareFlow: vi.fn()
    }
  },
  workflowStore: {
    activeWorkflow: null as ActiveWorkflow | null
  }
}))

vi.mock(
  '@/platform/workflow/sharing/components/ShareWorkflowDialogContent.vue',
  () => ({
    default: {
      name: 'ShareWorkflowDialogContent'
    }
  })
)

vi.mock('@/platform/workflow/sharing/composables/useShareFlowContext', () => ({
  useShareFlowContext: () => mocks.shareFlowContext
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => mocks.telemetry.value
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showLayoutDialog: mocks.showLayoutDialog
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    closeDialog: mocks.closeDialog
  })
}))

vi.mock('@/stores/appModeStore', () => ({
  useAppModeStore: () => ({
    pruneLinearData: mocks.pruneLinearData
  })
}))

vi.mock('../../management/stores/workflowStore', () => ({
  useWorkflowStore: () => mocks.workflowStore
}))

vi.mock('@/components/dialog/confirm/confirmDialog', () => ({
  showConfirmDialog: mocks.showConfirmDialog
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

const { useShareDialog } = await import('./useShareDialog')

describe('useShareDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.workflowStore.activeWorkflow = null
    mocks.pruneLinearData.mockReturnValue({
      inputs: [],
      outputs: ['output-node']
    })
    mocks.telemetry.value = {
      trackShareFlow: vi.fn()
    }
  })

  it('opens the share dialog when there is no active workflow', () => {
    const { show } = useShareDialog()

    show()

    expect(mocks.telemetry.value.trackShareFlow).toHaveBeenCalledWith({
      step: 'dialog_opened',
      source: 'graph_mode',
      view_mode: 'default',
      is_app_mode: false
    })
    expect(mocks.showLayoutDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'global-share-workflow',
        dialogComponentProps: {
          contentClass: 'sm:max-w-144 rounded-2xl overflow-hidden'
        }
      })
    )

    const options = mocks.showLayoutDialog.mock.calls[0]?.[0] as
      | ShareDialogOptions
      | undefined
    options?.props?.onClose?.()

    expect(mocks.closeDialog).toHaveBeenCalledWith({
      key: 'global-share-workflow'
    })
  })

  it('asks for confirmation before sharing an app workflow without outputs', () => {
    mocks.workflowStore.activeWorkflow = {
      initialMode: 'app',
      changeTracker: {
        activeState: {
          extra: {
            linearData: {
              nodes: []
            }
          }
        }
      }
    }
    mocks.pruneLinearData.mockReturnValue({
      inputs: [],
      outputs: []
    })

    const { show } = useShareDialog()

    show()

    expect(mocks.showConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        headerProps: {
          title: 'shareNoOutputs.title'
        },
        props: {
          promptText: 'shareNoOutputs.message',
          preserveNewlines: true
        }
      })
    )
    expect(mocks.showLayoutDialog).not.toHaveBeenCalled()

    const options = mocks.showConfirmDialog.mock.calls[0]?.[0] as
      | ConfirmDialogOptions
      | undefined
    options?.footerProps?.onConfirm?.()

    expect(mocks.closeDialog).toHaveBeenCalledWith('confirm-dialog')
    expect(mocks.showLayoutDialog).toHaveBeenCalledTimes(1)
  })

  it('keeps the share dialog closed when the no-output confirmation is cancelled', () => {
    mocks.workflowStore.activeWorkflow = {
      initialMode: 'app'
    }
    mocks.pruneLinearData.mockReturnValue({
      inputs: [],
      outputs: []
    })

    const { show } = useShareDialog()

    show()

    const options = mocks.showConfirmDialog.mock.calls[0]?.[0] as
      | ConfirmDialogOptions
      | undefined
    options?.footerProps?.onCancel?.()

    expect(mocks.closeDialog).toHaveBeenCalledWith('confirm-dialog')
    expect(mocks.showLayoutDialog).not.toHaveBeenCalled()
  })

  it('opens immediately when app workflow outputs are present', () => {
    mocks.workflowStore.activeWorkflow = {
      initialMode: 'app'
    }
    mocks.pruneLinearData.mockReturnValue({
      inputs: [],
      outputs: ['output-node']
    })

    const { show } = useShareDialog()

    show()

    expect(mocks.showConfirmDialog).not.toHaveBeenCalled()
    expect(mocks.showLayoutDialog).toHaveBeenCalledTimes(1)
  })

  it('opens immediately for graph workflows without outputs', () => {
    mocks.workflowStore.activeWorkflow = {
      initialMode: 'graph'
    }
    mocks.pruneLinearData.mockReturnValue({
      inputs: [],
      outputs: []
    })

    const { show } = useShareDialog()

    show()

    expect(mocks.showConfirmDialog).not.toHaveBeenCalled()
    expect(mocks.showLayoutDialog).toHaveBeenCalledTimes(1)
  })
})
