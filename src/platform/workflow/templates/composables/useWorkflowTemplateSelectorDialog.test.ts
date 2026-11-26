import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { useDialogService } from '@/services/dialogService'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDialogStore } from '@/stores/dialogStore'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'

let mockDialogStore: ReturnType<typeof useDialogStore>

const mockNewUserService = vi.hoisted(() => ({
  isNewUser: vi.fn()
}))

vi.mock(import('@/services/dialogService'))

vi.mock<unknown>(import('@/services/useNewUserService'), () => ({
  useNewUserService: () => mockNewUserService
}))

vi.mock(import('@comfyorg/telemetry'))

vi.mock<unknown>(
  import('@/platform/workflow/templates/components/WorkflowTemplateSelectorDialog.vue'),
  () => ({
    default: { name: 'MockWorkflowTemplateSelectorDialog' }
  })
)

import { useWorkflowTemplateSelectorDialog } from './useWorkflowTemplateSelectorDialog'

describe('useWorkflowTemplateSelectorDialog', () => {
  beforeEach(() => {
    mockDialogStore = useDialogStore()
    vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())
    useSettingStore().settingValues = {}
  })

  function lastInitialCategory() {
    const lastCall = vi
      .mocked(useDialogService().showLayoutDialog)
      .mock.calls.at(-1)
    assert(lastCall)
    const [options] = lastCall
    assert('initialCategory' in options.props)
    return options.props.initialCategory
  }

  describe('show', () => {
    it('defaults to "all" category for non-new users', () => {
      mockNewUserService.isNewUser.mockReturnValue(false)

      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show()

      expect(useDialogService().showLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            initialCategory: 'all'
          })
        })
      )
    })

    it('defaults to "popular" category for new users', () => {
      mockNewUserService.isNewUser.mockReturnValue(true)

      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show()

      expect(useDialogService().showLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({ initialCategory: 'popular' })
        })
      )
    })

    it('opens Popular only on the first open for a new user', () => {
      mockNewUserService.isNewUser.mockReturnValue(true)
      const dialog = useWorkflowTemplateSelectorDialog()

      dialog.show('first_run_nudge')
      expect(lastInitialCategory()).toBe('popular')

      dialog.show('sidebar')
      expect(lastInitialCategory()).toBe('all')
    })

    it('opens All for a still-new user who opened the library in an earlier session', () => {
      mockNewUserService.isNewUser.mockReturnValue(true)
      useSettingStore().settingValues = {
        'Comfy.Templates.HasOpenedLibrary': true
      }

      useWorkflowTemplateSelectorDialog().show()

      expect(lastInitialCategory()).toBe('all')
    })

    it('counts an open with an explicit category as the first open', () => {
      mockNewUserService.isNewUser.mockReturnValue(true)
      const dialog = useWorkflowTemplateSelectorDialog()

      dialog.show('appbuilder', { initialCategory: 'custom-category' })
      dialog.show('sidebar')

      expect(lastInitialCategory()).toBe('all')
    })

    it('records the first open for existing users too', () => {
      mockNewUserService.isNewUser.mockReturnValue(false)

      useWorkflowTemplateSelectorDialog().show()

      expect(useSettingStore().get('Comfy.Templates.HasOpenedLibrary')).toBe(
        true
      )
    })

    it('reports a failed first-open write without breaking the open', async () => {
      const failure = new Error('offline')
      vi.mocked(api.storeSetting).mockRejectedValueOnce(failure)
      mockNewUserService.isNewUser.mockReturnValue(true)

      useWorkflowTemplateSelectorDialog().show()

      expect(lastInitialCategory()).toBe('popular')
      await vi.waitFor(() =>
        expect(reportError).toHaveBeenCalledWith(failure, {
          surface: 'platform',
          errorType: 'failure_writing_templates_opened_library_setting',
          level: 'warning'
        })
      )
    })

    it('reports a first-open write the server answers with a 500', async () => {
      vi.mocked(api.storeSetting).mockResolvedValueOnce(
        new Response(null, { status: 500 })
      )
      mockNewUserService.isNewUser.mockReturnValue(true)

      useWorkflowTemplateSelectorDialog().show()

      expect(lastInitialCategory()).toBe('popular')
      await vi.waitFor(() =>
        expect(reportError).toHaveBeenCalledWith(
          expect.objectContaining({ message: expect.stringContaining('500') }),
          {
            surface: 'platform',
            errorType: 'failure_writing_templates_opened_library_setting',
            level: 'warning'
          }
        )
      )
    })

    it('reports a refused first-open write and retries it on the next open', async () => {
      vi.mocked(api.storeSetting).mockResolvedValueOnce(
        new Response(null, { status: 422 })
      )
      mockNewUserService.isNewUser.mockReturnValue(true)
      const dialog = useWorkflowTemplateSelectorDialog()

      dialog.show()
      expect(lastInitialCategory()).toBe('popular')
      await vi.waitFor(() =>
        expect(reportError).toHaveBeenCalledWith(
          expect.objectContaining({ message: expect.stringContaining('422') }),
          {
            surface: 'platform',
            errorType: 'failure_writing_templates_opened_library_setting',
            level: 'warning'
          }
        )
      )
      await vi.waitFor(() =>
        expect(
          useSettingStore().get('Comfy.Templates.HasOpenedLibrary')
        ).toBeFalsy()
      )

      const writesBeforeRetry = vi.mocked(api.storeSetting).mock.calls.length
      dialog.show()
      expect(lastInitialCategory()).toBe('popular')
      await vi.waitFor(() =>
        expect(vi.mocked(api.storeSetting).mock.calls.length).toBe(
          writesBeforeRetry + 1
        )
      )

      dialog.show()
      expect(lastInitialCategory()).toBe('all')
    })

    it('defaults to "all" when new user status is undetermined', () => {
      mockNewUserService.isNewUser.mockReturnValue(null)

      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show()

      expect(useDialogService().showLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            initialCategory: 'all'
          })
        })
      )
    })

    it('uses explicit initialCategory when provided', () => {
      mockNewUserService.isNewUser.mockReturnValue(true)

      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show('command', { initialCategory: 'custom-category' })

      expect(useDialogService().showLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            initialCategory: 'custom-category'
          })
        })
      )
    })

    it('invokes afterClose callback when dialog is closed', () => {
      mockNewUserService.isNewUser.mockReturnValue(false)
      const afterClose = vi.fn()

      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show('command', { afterClose })

      const [options] = vi.mocked(useDialogService().showLayoutDialog).mock
        .calls[0]
      assert('onClose' in options.props)
      const { onClose } = options.props
      assert(typeof onClose === 'function')
      onClose()

      expect(mockDialogStore.closeDialog).toHaveBeenCalled()
      expect(afterClose).toHaveBeenCalled()
    })

    it('does not fail when afterClose is not provided', () => {
      mockNewUserService.isNewUser.mockReturnValue(false)

      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show('command')

      const [options] = vi.mocked(useDialogService().showLayoutDialog).mock
        .calls[0]
      assert('onClose' in options.props)
      const { onClose } = options.props
      assert(typeof onClose === 'function')
      expect(() => onClose()).not.toThrow()
    })

    it('tracks telemetry with source', () => {
      mockNewUserService.isNewUser.mockReturnValue(false)

      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show('sidebar')

      expect(useTelemetry()?.trackTemplateLibraryOpened).toHaveBeenCalledWith({
        source: 'sidebar'
      })
    })
  })

  describe('hide', () => {
    it('closes the dialog', () => {
      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.hide()

      expect(mockDialogStore.closeDialog).toHaveBeenCalledWith({
        key: 'global-workflow-template-selector'
      })
    })
  })
})
