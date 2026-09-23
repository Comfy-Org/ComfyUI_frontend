import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import { useDialogService } from '@/services/dialogService'
import { fromPartial } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAppMode } from '@/composables/useAppMode'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useDialogStore } from '@/stores/dialogStore'

import { useBuilderSave } from './useBuilderSave'

beforeEach(() => {
  vi.mocked(useAppModeStore().exitBuilder).mockImplementation(() => {})
  vi.mocked(useDialogStore().closeDialog).mockImplementation(() => {})
  vi.mocked(t).mockImplementation((key: unknown, params?: unknown) =>
    params ? `${String(key)}:${JSON.stringify(params)}` : String(key)
  )
})

vi.mock(import('@/composables/useAppMode'))

vi.mock(import('@/composables/useErrorHandling'))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/platform/workflow/core/services/workflowService'))

vi.mock(import('@/services/dialogService'))

vi.mock(import('@/components/dialog/confirm/confirmDialog'))

vi.mock(import('@/i18n'))

vi.mock<unknown>(import('./BuilderSaveDialogContent.vue'), () => ({
  default: { template: '<div />' }
}))

const SAVE_DIALOG_KEY = 'builder-save'
const SUCCESS_DIALOG_KEY = 'builder-save-success'

describe('useBuilderSave', () => {
  beforeEach(() => {
    useWorkflowStore().activeWorkflow = null
  })

  function openSaveDialog() {
    useWorkflowStore().activeWorkflow = fromPartial({
      filename: 'my-workflow',
      initialMode: 'app'
    })
    const { saveAs } = useBuilderSave()
    saveAs()
    const [options] = vi.mocked(useDialogService().showLayoutDialog).mock
      .calls[0]
    assert('onSave' in options.props)
    const { onSave } = options.props
    assert(typeof onSave === 'function')
    return onSave
  }

  describe('save()', () => {
    it('does nothing when there is no active workflow', async () => {
      const { save } = useBuilderSave()

      await save()

      expect(
        vi.mocked(useWorkflowService().saveWorkflow)
      ).not.toHaveBeenCalled()
    })

    it('saves workflow directly without showing a dialog', async () => {
      useWorkflowStore().activeWorkflow = fromPartial({
        filename: 'my-workflow',
        initialMode: 'app'
      })
      vi.mocked(useWorkflowService().saveWorkflow).mockResolvedValueOnce(true)
      const { save } = useBuilderSave()

      await save()

      expect(
        vi.mocked(useWorkflowService().saveWorkflow)
      ).toHaveBeenCalledOnce()
      expect(showConfirmDialog).not.toHaveBeenCalled()
    })

    it('toasts error on failure', async () => {
      useWorkflowStore().activeWorkflow = fromPartial({
        filename: 'my-workflow',
        initialMode: 'app'
      })
      const error = new Error('save failed')
      vi.mocked(useWorkflowService().saveWorkflow).mockRejectedValueOnce(error)
      const { save } = useBuilderSave()

      await save()

      expect(useErrorHandling().toastErrorHandler).toHaveBeenCalledWith(error)
      expect(showConfirmDialog).not.toHaveBeenCalled()
    })

    it('prevents concurrent saves', async () => {
      useWorkflowStore().activeWorkflow = fromPartial({
        filename: 'my-workflow',
        initialMode: 'app'
      })
      let resolveSave!: (saved: boolean) => void
      vi.mocked(useWorkflowService().saveWorkflow).mockReturnValueOnce(
        new Promise<boolean>((r) => {
          resolveSave = r
        })
      )
      const { save, isSaving } = useBuilderSave()

      const firstSave = save()
      expect(isSaving.value).toBe(true)

      await save()
      expect(
        vi.mocked(useWorkflowService().saveWorkflow)
      ).toHaveBeenCalledOnce()

      resolveSave(true)
      await firstSave
      expect(isSaving.value).toBe(false)
    })
  })

  describe('saveAs()', () => {
    it('does nothing when there is no active workflow', () => {
      useWorkflowStore().activeWorkflow = null
      const { saveAs } = useBuilderSave()

      saveAs()

      expect(useDialogService().showLayoutDialog).not.toHaveBeenCalled()
    })

    it('opens save dialog with correct defaultFilename and defaultOpenAsApp', () => {
      useWorkflowStore().activeWorkflow = fromPartial({
        filename: 'my-workflow',
        initialMode: 'app'
      })
      const { saveAs } = useBuilderSave()

      saveAs()

      expect(
        useDialogService().showLayoutDialog
      ).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          key: SAVE_DIALOG_KEY,
          props: expect.objectContaining({
            defaultFilename: 'my-workflow',
            defaultOpenAsApp: true
          }),
          dialogComponentProps: expect.objectContaining({
            useAutomaticLabeling: true
          })
        })
      )
    })

    it('passes defaultOpenAsApp: false when initialMode is graph', () => {
      useWorkflowStore().activeWorkflow = fromPartial({
        filename: 'my-workflow',
        initialMode: 'graph'
      })
      const { saveAs } = useBuilderSave()

      saveAs()

      expect(
        useDialogService().showLayoutDialog
      ).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          props: expect.objectContaining({ defaultOpenAsApp: false })
        })
      )
    })
  })

  describe('save dialog callbacks', () => {
    it('onSave calls saveWorkflowAs with isApp and tracks telemetry', async () => {
      vi.mocked(useWorkflowService().saveWorkflowAs).mockResolvedValueOnce(true)
      const onSave = openSaveDialog()

      await onSave('new-name', true)

      expect(
        vi.mocked(useWorkflowService().saveWorkflowAs)
      ).toHaveBeenCalledWith(useWorkflowStore().activeWorkflow, {
        filename: 'new-name',
        isApp: true
      })
      expect(useTelemetry()?.trackDefaultViewSet).toHaveBeenCalledWith({
        default_view: 'app'
      })
    })

    it('onSave passes isApp: false when saving as graph', async () => {
      vi.mocked(useWorkflowService().saveWorkflowAs).mockResolvedValueOnce(true)
      const onSave = openSaveDialog()

      await onSave('new-name', false)

      expect(
        vi.mocked(useWorkflowService().saveWorkflowAs)
      ).toHaveBeenCalledWith(useWorkflowStore().activeWorkflow, {
        filename: 'new-name',
        isApp: false
      })
      expect(useTelemetry()?.trackDefaultViewSet).toHaveBeenCalledWith({
        default_view: 'graph'
      })
    })

    it('onSave does not track or close when saveWorkflowAs returns falsy', async () => {
      vi.mocked(useWorkflowService().saveWorkflowAs).mockResolvedValueOnce(
        false
      )
      const onSave = openSaveDialog()

      await onSave('new-name', false)

      expect(useTelemetry()?.trackDefaultViewSet).not.toHaveBeenCalled()
      expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
    })

    it('onSave closes dialog and shows success dialog after successful save', async () => {
      vi.mocked(useWorkflowService().saveWorkflowAs).mockResolvedValueOnce(true)
      const onSave = openSaveDialog()

      await onSave('new-name', true)

      expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
        key: SAVE_DIALOG_KEY
      })
      expect(showConfirmDialog).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ key: SUCCESS_DIALOG_KEY })
      )
    })

    it('shows app success message when openAsApp is true', async () => {
      vi.mocked(useWorkflowService().saveWorkflowAs).mockResolvedValueOnce(true)
      const onSave = openSaveDialog()

      await onSave('new-name', true)

      expect(showConfirmDialog).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          props: expect.objectContaining({
            promptText: 'builderSave.successBodyApp'
          })
        })
      )
    })

    it('shows graph success message with exit builder button when openAsApp is false', async () => {
      vi.mocked(useWorkflowService().saveWorkflowAs).mockResolvedValueOnce(true)
      const onSave = openSaveDialog()

      await onSave('new-name', false)

      expect(showConfirmDialog).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          props: expect.objectContaining({
            promptText: 'builderSave.successBodyGraph'
          }),
          footerProps: expect.objectContaining({
            confirmText: 'linearMode.builder.exit',
            cancelText: 'builderToolbar.viewApp'
          })
        })
      )
    })

    it('onSave toasts error and closes dialog on failure', async () => {
      const error = new Error('save-as failed')
      vi.mocked(useWorkflowService().saveWorkflowAs).mockRejectedValueOnce(
        error
      )
      const onSave = openSaveDialog()

      await onSave('new-name', false)

      expect(useErrorHandling().toastErrorHandler).toHaveBeenCalledWith(error)
      expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
        key: SAVE_DIALOG_KEY
      })
    })

    it('prevents concurrent handleSaveAs calls', async () => {
      let resolveSaveAs!: (v: boolean) => void
      vi.mocked(useWorkflowService().saveWorkflowAs).mockReturnValueOnce(
        new Promise<boolean>((r) => {
          resolveSaveAs = r
        })
      )
      const onSave = openSaveDialog()

      const firstSave = onSave('new-name', true)
      expect(firstSave).toBeInstanceOf(Promise)

      await onSave('other-name', true)
      expect(
        vi.mocked(useWorkflowService().saveWorkflowAs)
      ).toHaveBeenCalledOnce()

      resolveSaveAs(true)
      await firstSave
    })
  })

  describe('graph success dialog callbacks', () => {
    async function getGraphSuccessDialogProps() {
      vi.mocked(useWorkflowService().saveWorkflowAs).mockResolvedValueOnce(true)
      const onSave = openSaveDialog()
      await onSave('new-name', false)
      const [options] = vi.mocked(showConfirmDialog).mock.calls[0]
      assert.exists(options?.footerProps)
      const { onConfirm, onCancel } = options.footerProps
      assert(typeof onConfirm === 'function')
      assert(typeof onCancel === 'function')
      return { onConfirm, onCancel }
    }

    it('onConfirm closes dialog and exits builder', async () => {
      const { onConfirm } = await getGraphSuccessDialogProps()

      onConfirm()

      expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
        key: SUCCESS_DIALOG_KEY
      })
      expect(useAppModeStore().exitBuilder).toHaveBeenCalledOnce()
    })

    it('onCancel closes dialog and switches to app mode', async () => {
      const { onCancel } = await getGraphSuccessDialogProps()

      onCancel()

      expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
        key: SUCCESS_DIALOG_KEY
      })
      expect(useTelemetry()?.trackEnterLinear).toHaveBeenCalledWith({
        source: 'app_builder'
      })
      expect(useAppMode().setMode).toHaveBeenCalledWith('app')
    })
  })
})
