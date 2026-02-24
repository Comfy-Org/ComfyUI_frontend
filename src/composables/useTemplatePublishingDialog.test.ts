import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDialogService = vi.hoisted(() => ({
  showLayoutDialog: vi.fn()
}))

const mockDialogStore = vi.hoisted(() => ({
  closeDialog: vi.fn()
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => mockDialogService
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => mockDialogStore
}))

vi.mock('@/components/templatePublishing/TemplatePublishingDialog.vue', () => ({
  default: { name: 'MockTemplatePublishingDialog' }
}))

import { useTemplatePublishingDialog } from './useTemplatePublishingDialog'

describe('useTemplatePublishingDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('show', () => {
    it('opens the dialog via dialogService', () => {
      const { show } = useTemplatePublishingDialog()
      show()

      expect(mockDialogService.showLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'global-template-publishing'
        })
      )
    })

    it('passes initialPage to the dialog component', () => {
      const { show } = useTemplatePublishingDialog()
      show({ initialPage: 'metadata' })

      expect(mockDialogService.showLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            initialPage: 'metadata'
          })
        })
      )
    })

    it('passes undefined initialPage when no options given', () => {
      const { show } = useTemplatePublishingDialog()
      show()

      expect(mockDialogService.showLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            initialPage: undefined
          })
        })
      )
    })

    it('provides an onClose callback that closes the dialog', () => {
      const { show } = useTemplatePublishingDialog()
      show()

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      call.props.onClose()

      expect(mockDialogStore.closeDialog).toHaveBeenCalledWith({
        key: 'global-template-publishing'
      })
    })
  })

  describe('hide', () => {
    it('closes the dialog via dialogStore', () => {
      const { hide } = useTemplatePublishingDialog()
      hide()

      expect(mockDialogStore.closeDialog).toHaveBeenCalledWith({
        key: 'global-template-publishing'
      })
    })
  })
})
