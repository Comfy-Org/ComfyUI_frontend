import { useDialogService } from '@/services/dialogService'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDialogStore } from '@/stores/dialogStore'
import { useTelemetry } from '@/platform/telemetry'

let mockDialogStore: ReturnType<typeof useDialogStore>

const mockNewUserService = vi.hoisted(() => ({
  isNewUser: vi.fn()
}))

vi.mock(import('@/services/dialogService'))

vi.mock<unknown>(import('@/services/useNewUserService'), () => ({
  useNewUserService: () => mockNewUserService
}))

vi.mock(import('@/platform/telemetry'))

vi.mock<unknown>(
  import('@/components/custom/widget/WorkflowTemplateSelectorDialog.vue'),
  () => ({
    default: { name: 'MockWorkflowTemplateSelectorDialog' }
  })
)

import { useWorkflowTemplateSelectorDialog } from './useWorkflowTemplateSelectorDialog'

describe('useWorkflowTemplateSelectorDialog', () => {
  beforeEach(() => {
    mockDialogStore = useDialogStore()
  })

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
