import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDialogService = vi.hoisted(() => ({
  showLayoutDialog: vi.fn()
}))

const mockDialogStore = vi.hoisted(() => ({
  closeDialog: vi.fn()
}))

const mockNewUserService = vi.hoisted(() => ({
  isNewUser: vi.fn()
}))

const mockTelemetry = vi.hoisted(() => ({
  trackTemplateLibraryOpened: vi.fn()
}))

const mockAppMode = vi.hoisted(() => ({ isBuilderMode: false }))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => mockDialogService
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => mockDialogStore
}))

vi.mock('@/services/useNewUserService', () => ({
  useNewUserService: () => mockNewUserService
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => mockTelemetry
}))

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({
    isBuilderMode: {
      get value() {
        return mockAppMode.isBuilderMode
      }
    }
  })
}))

vi.mock(
  '@/components/custom/widget/WorkflowTemplateSelectorDialog.vue',
  () => ({
    default: { name: 'MockWorkflowTemplateSelectorDialog' }
  })
)

import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { useTemplatesPanelStore } from '@/stores/workspace/templatesPanelStore'

import { useWorkflowTemplateSelectorDialog } from './useWorkflowTemplateSelectorDialog'

describe('useWorkflowTemplateSelectorDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockAppMode.isBuilderMode = false
  })

  describe('show (panel path)', () => {
    it('activates the templates sidebar tab instead of opening the modal', () => {
      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show('sidebar')

      expect(useSidebarTabStore().activeSidebarTabId).toBe('templates')
      expect(mockDialogService.showLayoutDialog).not.toHaveBeenCalled()
    })

    it('stashes the open context for the panel to consume', () => {
      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show('menu', { initialCategory: 'custom-category' })

      const panelStore = useTemplatesPanelStore()
      expect(panelStore.consumeRequestedCategory()).toBe('custom-category')
      expect(panelStore.consumeOpenSource()).toBe('menu')
    })

    it('leaves opened telemetry to the panel component', () => {
      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show('sidebar')

      expect(mockTelemetry.trackTemplateLibraryOpened).not.toHaveBeenCalled()
    })

    it('keeps the tab active when show is called while already open', () => {
      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show('sidebar')
      dialog.show('command')

      expect(useSidebarTabStore().activeSidebarTabId).toBe('templates')
    })
  })

  describe('show (builder fallback to modal)', () => {
    beforeEach(() => {
      mockAppMode.isBuilderMode = true
    })

    it('defaults to "all" category for non-new users', () => {
      mockNewUserService.isNewUser.mockReturnValue(false)

      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show()

      expect(mockDialogService.showLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            initialCategory: 'all'
          })
        })
      )
    })

    it('defaults to "basics-getting-started" category for new users', () => {
      mockNewUserService.isNewUser.mockReturnValue(true)

      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show()

      expect(mockDialogService.showLayoutDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            initialCategory: 'basics-getting-started'
          })
        })
      )
    })

    it('uses explicit initialCategory when provided', () => {
      mockNewUserService.isNewUser.mockReturnValue(true)

      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show('command', { initialCategory: 'custom-category' })

      expect(mockDialogService.showLayoutDialog).toHaveBeenCalledWith(
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

      const onClose =
        mockDialogService.showLayoutDialog.mock.calls[0][0].props.onClose
      onClose()

      expect(mockDialogStore.closeDialog).toHaveBeenCalled()
      expect(afterClose).toHaveBeenCalled()
    })

    it('tracks telemetry with source', () => {
      mockNewUserService.isNewUser.mockReturnValue(false)

      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show('sidebar')

      expect(mockTelemetry.trackTemplateLibraryOpened).toHaveBeenCalledWith({
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

    it('deactivates the templates tab when it is open', () => {
      const dialog = useWorkflowTemplateSelectorDialog()
      dialog.show('sidebar')
      expect(useSidebarTabStore().activeSidebarTabId).toBe('templates')

      dialog.hide()
      expect(useSidebarTabStore().activeSidebarTabId).toBeNull()
    })
  })
})
