import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import EditorToolbar from './EditorToolbar.vue'
import { useMaskEditorStore } from '#/maskEditorStore'

let mockStore: ReturnType<typeof useMaskEditorStore>

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

vi.mock(import('#/useCanvasTools'), () => ({
  useCanvasTools: () => fromPartial(mockCanvasTools)
}))

vi.mock(import('#/useCanvasTransform'), () => ({
  useCanvasTransform: () => mockCanvasTransform
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

const renderHeader = (saving = false) =>
  render(EditorToolbar, { props: { saving }, global: { plugins: [i18n] } })

describe('EditorToolbar', () => {
  beforeEach(() => {
    mockStore = useMaskEditorStore()
    vi.spyOn(mockStore.canvasHistory, 'undo').mockImplementation(() => {})
    vi.spyOn(mockStore.canvasHistory, 'redo').mockImplementation(() => {})
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

      expect(mockStore.canvasHistory.undo).toHaveBeenCalledTimes(1)
    })

    it('should call canvasHistory.redo when redo button is clicked', async () => {
      const user = userEvent.setup()
      renderHeader()

      await user.click(screen.getByRole('button', { name: 'Redo' }))

      expect(mockStore.canvasHistory.redo).toHaveBeenCalledTimes(1)
    })
  })

  describe('canvas transform buttons', () => {
    it.for([
      ['Rotate Left', 'rotateCounterclockwise'],
      ['Rotate Right', 'rotateClockwise'],
      ['Mirror Horizontal', 'mirrorHorizontal'],
      ['Mirror Vertical', 'mirrorVertical']
    ] as const)(
      'should call canvasTransform.%s when %s button is clicked',
      async ([label, method]) => {
        const user = userEvent.setup()
        renderHeader()

        await user.click(screen.getByRole('button', { name: label }))

        expect(mockCanvasTransform[method]).toHaveBeenCalledTimes(1)
      }
    )

    it.for([
      ['Rotate Left', 'rotateCounterclockwise', 'Rotate left failed:'],
      ['Rotate Right', 'rotateClockwise', 'Rotate right failed:'],
      ['Mirror Horizontal', 'mirrorHorizontal', 'Mirror horizontal failed:'],
      ['Mirror Vertical', 'mirrorVertical', 'Mirror vertical failed:']
    ] as const)(
      'should swallow and log errors from %s',
      async ([label, method, expectedMsg]) => {
        mockCanvasTransform[method].mockRejectedValueOnce(new Error('boom'))
        const user = userEvent.setup()
        renderHeader()

        await user.click(screen.getByRole('button', { name: label }))

        expect(console.error).toHaveBeenCalledWith(
          `[TopBarHeader] ${expectedMsg}`,
          expect.any(Error)
        )
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
    it('emits save when Save is clicked', async () => {
      const user = userEvent.setup()
      const { emitted } = renderHeader()

      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(emitted('save')).toEqual([[]])
    })

    it('shows Saving and prevents save requests while saving', async () => {
      const user = userEvent.setup()
      const { emitted } = renderHeader(true)
      const savingButton = screen.getByRole('button', { name: 'Saving' })

      expect(savingButton).toBeDisabled()
      await user.click(savingButton)
      expect(emitted('save')).toBeUndefined()
    })
  })

  describe('cancel', () => {
    it('emits cancel even while saving', async () => {
      const user = userEvent.setup()
      const { emitted } = renderHeader(true)

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(emitted('cancel')).toEqual([[]])
    })
  })
})
