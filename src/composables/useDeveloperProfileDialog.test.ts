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

vi.mock('@/components/developerProfile/DeveloperProfileDialog.vue', () => ({
  default: { name: 'MockDeveloperProfileDialog' }
}))

import { useDeveloperProfileDialog } from './useDeveloperProfileDialog'

describe('useDeveloperProfileDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('show', () => {
    it('opens the dialog via dialogService', () => {
      const { show } = useDeveloperProfileDialog()
      show()

      expect(mockDialogService.showLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'global-developer-profile'
        })
      )
    })

    it('passes username to the dialog component', () => {
      const { show } = useDeveloperProfileDialog()
      show('@TestUser')

      expect(mockDialogService.showLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            username: '@TestUser'
          })
        })
      )
    })

    it('passes undefined username when no argument given', () => {
      const { show } = useDeveloperProfileDialog()
      show()

      expect(mockDialogService.showLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            username: undefined
          })
        })
      )
    })

    it('provides an onClose callback that closes the dialog', () => {
      const { show } = useDeveloperProfileDialog()
      show()

      const call = mockDialogService.showLayoutDialog.mock.calls[0][0]
      call.props.onClose()

      expect(mockDialogStore.closeDialog).toHaveBeenCalledWith({
        key: 'global-developer-profile'
      })
    })
  })

  describe('hide', () => {
    it('closes the dialog via dialogStore', () => {
      const { hide } = useDeveloperProfileDialog()
      hide()

      expect(mockDialogStore.closeDialog).toHaveBeenCalledWith({
        key: 'global-developer-profile'
      })
    })
  })
})
