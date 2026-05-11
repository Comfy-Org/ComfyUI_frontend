import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import TopBarHeader from '@/components/maskeditor/dialog/TopBarHeader.vue'

const mockCanvasHistory = vi.hoisted(() => ({
  undo: vi.fn(),
  redo: vi.fn()
}))

const initialMock = () =>
  reactive({
    canvasHistory: mockCanvasHistory,
    brushVisible: true,
    triggerClear: vi.fn()
  })

let mockStore: ReturnType<typeof initialMock>

const mockDialogStore = vi.hoisted(() => ({
  closeDialog: vi.fn()
}))

const mockCanvasTools = vi.hoisted(() => ({
  invertMask: vi.fn(),
  clearMask: vi.fn()
}))

const mockCanvasTransform = vi.hoisted(() => ({
  rotateCounterclockwise: vi.fn().mockResolvedValue(undefined),
  rotateClockwise: vi.fn().mockResolvedValue(undefined),
  mirrorHorizontal: vi.fn().mockResolvedValue(undefined),
  mirrorVertical: vi.fn().mockResolvedValue(undefined)
}))

const mockSaver = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: () => mockStore
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => mockDialogStore
}))

vi.mock('@/composables/maskeditor/useCanvasTools', () => ({
  useCanvasTools: () => mockCanvasTools
}))

vi.mock('@/composables/maskeditor/useCanvasTransform', () => ({
  useCanvasTransform: () => mockCanvasTransform
}))

vi.mock('@/composables/maskeditor/useMaskEditorSaver', () => ({
  useMaskEditorSaver: () => mockSaver
}))

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    name: 'ButtonStub',
    props: ['variant', 'disabled'],
    template:
      '<button :data-variant="variant" :disabled="disabled"><slot /></button>'
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        save: 'Save',
        saving: 'Saving',
        cancel: 'Cancel'
      },
      maskEditor: {
        title: 'Mask Editor',
        invert: 'Invert',
        clear: 'Clear',
        undo: 'Undo',
        redo: 'Redo',
        rotateLeft: 'Rotate Left',
        rotateRight: 'Rotate Right',
        mirrorHorizontal: 'Mirror Horizontal',
        mirrorVertical: 'Mirror Vertical'
      }
    }
  }
})

const renderHeader = () => render(TopBarHeader, { global: { plugins: [i18n] } })

describe('TopBarHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore = initialMock()
  })

  describe('title', () => {
    it('should render the localized title', () => {
      renderHeader()
      expect(screen.getByText('Mask Editor')).toBeInTheDocument()
    })
  })

  describe('history buttons', () => {
    it('should call canvasHistory.undo when undo button is clicked', async () => {
      const user = userEvent.setup()
      renderHeader()

      await user.click(screen.getByRole('button', { name: 'Undo' }))

      expect(mockCanvasHistory.undo).toHaveBeenCalledTimes(1)
    })

    it('should call canvasHistory.redo when redo button is clicked', async () => {
      const user = userEvent.setup()
      renderHeader()

      await user.click(screen.getByRole('button', { name: 'Redo' }))

      expect(mockCanvasHistory.redo).toHaveBeenCalledTimes(1)
    })
  })

  describe('canvas transform buttons', () => {
    it.each([
      ['Rotate Left', 'rotateCounterclockwise'],
      ['Rotate Right', 'rotateClockwise'],
      ['Mirror Horizontal', 'mirrorHorizontal'],
      ['Mirror Vertical', 'mirrorVertical']
    ] as const)(
      'should call canvasTransform.%s when %s button is clicked',
      async (label, method) => {
        const user = userEvent.setup()
        renderHeader()

        await user.click(screen.getByRole('button', { name: label }))

        expect(mockCanvasTransform[method]).toHaveBeenCalledTimes(1)
      }
    )

    it.each([
      ['Rotate Left', 'rotateCounterclockwise', 'Rotate left failed:'],
      ['Rotate Right', 'rotateClockwise', 'Rotate right failed:'],
      ['Mirror Horizontal', 'mirrorHorizontal', 'Mirror horizontal failed:'],
      ['Mirror Vertical', 'mirrorVertical', 'Mirror vertical failed:']
    ] as const)(
      'should swallow and log errors from %s',
      async (label, method, expectedMsg) => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        mockCanvasTransform[method].mockRejectedValueOnce(new Error('boom'))
        const user = userEvent.setup()
        renderHeader()

        await user.click(screen.getByRole('button', { name: label }))

        expect(errorSpy).toHaveBeenCalledWith(
          `[TopBarHeader] ${expectedMsg}`,
          expect.any(Error)
        )
        errorSpy.mockRestore()
      }
    )
  })

  describe('mask edit buttons', () => {
    it('should call canvasTools.invertMask on Invert click', async () => {
      const user = userEvent.setup()
      renderHeader()

      await user.click(screen.getByRole('button', { name: 'Invert' }))

      expect(mockCanvasTools.invertMask).toHaveBeenCalledTimes(1)
    })

    it('should call clearMask and store.triggerClear on Clear click', async () => {
      const user = userEvent.setup()
      renderHeader()

      await user.click(screen.getByRole('button', { name: 'Clear' }))

      expect(mockCanvasTools.clearMask).toHaveBeenCalledTimes(1)
      expect(mockStore.triggerClear).toHaveBeenCalledTimes(1)
    })
  })

  describe('save', () => {
    it('should hide brush, save, and close the dialog on success', async () => {
      const user = userEvent.setup()
      renderHeader()
      mockStore.brushVisible = true

      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(mockStore.brushVisible).toBe(false)
      expect(mockSaver.save).toHaveBeenCalledTimes(1)
      expect(mockDialogStore.closeDialog).toHaveBeenCalledTimes(1)
    })

    it('should switch the button text to "Saving" and disable the button while saving', async () => {
      let resolve!: () => void
      mockSaver.save.mockReturnValueOnce(
        new Promise<void>((r) => {
          resolve = r
        })
      )
      const user = userEvent.setup()
      renderHeader()

      const clickPromise = user.click(
        screen.getByRole('button', { name: /save/i })
      )
      const savingBtn = await screen.findByRole('button', { name: 'Saving' })
      expect(savingBtn).toBeDisabled()

      resolve()
      await clickPromise
    })

    it('should restore brush + button state and log on save failure', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockSaver.save.mockRejectedValueOnce(new Error('save failed'))
      const user = userEvent.setup()
      renderHeader()

      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(mockStore.brushVisible).toBe(true)
      expect(errorSpy).toHaveBeenCalledWith(
        '[TopBarHeader] Save failed:',
        expect.any(Error)
      )
      expect(mockDialogStore.closeDialog).not.toHaveBeenCalled()
      // After failure, the Save button reads "Save" again (not "Saving")
      expect(
        screen.getByRole('button', { name: /save/i }).textContent?.trim()
      ).toBe('Save')
      errorSpy.mockRestore()
    })
  })

  describe('cancel', () => {
    it('should close the dialog with the global-mask-editor key', async () => {
      const user = userEvent.setup()
      renderHeader()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(mockDialogStore.closeDialog).toHaveBeenCalledWith({
        key: 'global-mask-editor'
      })
    })
  })
})
