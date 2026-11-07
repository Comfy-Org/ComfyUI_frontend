import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import type { useMaskEditorSaver } from '@/renderer/extensions/maskEditor/composables/useMaskEditorSaver'
import { createI18n } from 'vue-i18n'

import TopBarHeader from '@/renderer/extensions/maskEditor/components/dialog/TopBarHeader.vue'
import { useMaskEditor } from '@/renderer/extensions/maskEditor/composables/useMaskEditor'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useDialogStore } from '@/stores/dialogStore'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'

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

const mockSaver = vi.hoisted(() => ({
  save: vi.fn<ReturnType<typeof useMaskEditorSaver>['save']>(
    async () => 'saved'
  )
}))

vi.mock<unknown>(import('@comfyorg/mask-editor/useCanvasTools'), () => ({
  useCanvasTools: () => mockCanvasTools
}))

vi.mock(import('@comfyorg/mask-editor/useCanvasTransform'), () => ({
  useCanvasTransform: () => mockCanvasTransform
}))

vi.mock(
  import('@/renderer/extensions/maskEditor/composables/useMaskEditorSaver'),
  () => ({
    useMaskEditorSaver: () => mockSaver
  })
)

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

const renderHeader = (
  props: Partial<{ signal: AbortSignal; closeSession: () => void }> = {}
) =>
  render(TopBarHeader, {
    props: {
      signal: props.signal ?? new AbortController().signal,
      closeSession:
        props.closeSession ??
        (() => useDialogStore().closeDialog({ key: 'global-mask-editor' }))
    },
    global: { plugins: [i18n] }
  })

describe('TopBarHeader', () => {
  beforeEach(() => {
    mockStore = useMaskEditorStore()
    vi.spyOn(mockStore.canvasHistory, 'undo').mockImplementation(() => {})
    vi.spyOn(mockStore.canvasHistory, 'redo').mockImplementation(() => {})
  })

  it('starts a fresh header when a saving dialog is replaced before the render flush', async () => {
    let finishSave = () => {}
    mockSaver.save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSave = () => resolve('saved')
        })
    )
    const dialogs = useDialogStore()
    render(
      defineComponent(
        () => () =>
          h(
            'div',
            dialogs.dialogStack.map((dialog) =>
              h('div', { key: dialog.key }, [
                dialog.headerComponent
                  ? h(dialog.headerComponent, dialog.headerProps)
                  : null
              ])
            )
          )
      ),
      { global: { plugins: [i18n] } }
    )
    const node = new LGraphNode('Mask editor test')
    node.imgs = [new Image()]
    const editor = useMaskEditor()
    editor.openMaskEditor(node)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled()
    dialogs.closeDialog({ key: 'global-mask-editor' })
    editor.openMaskEditor(node)
    expect(await screen.findByRole('button', { name: 'Save' })).toBeEnabled()
    finishSave()
    await nextTick()
    expect(dialogs.dialogStack).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
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
        vi.mocked(console.error).mockRestore()
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
      const signal = new AbortController().signal
      renderHeader({ signal })
      mockStore.brushVisible = true

      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(mockStore.brushVisible).toBe(false)
      expect(mockSaver.save).toHaveBeenCalledExactlyOnceWith(signal)
      expect(useDialogStore().closeDialog).toHaveBeenCalledTimes(1)
    })

    it('should switch the button text to "Saving" and disable the button while saving', async () => {
      let resolve!: () => void
      mockSaver.save.mockReturnValueOnce(
        new Promise<'saved' | 'cancelled'>((r) => {
          resolve = () => r('saved')
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

    it.for([
      {
        outcome: 'success',
        settle: (
          resolve: (value: 'saved' | 'cancelled') => void,
          _reject: (error: Error) => void
        ) => resolve('saved')
      },
      {
        outcome: 'failure',
        settle: (
          _resolve: (value: 'saved' | 'cancelled') => void,
          reject: (error: Error) => void
        ) => reject(new Error('old save failed'))
      }
    ])(
      'does not close or change a replacement editor after a cancelled save finishes with $outcome',
      async ({ settle }) => {
        let resolve!: (value: 'saved' | 'cancelled') => void
        let reject!: (error: Error) => void
        mockSaver.save.mockReturnValueOnce(
          new Promise((yes, no) => {
            resolve = yes
            reject = no
          })
        )
        const controller = new AbortController()
        const closeSession = vi.fn()
        const oldHeader = renderHeader({
          signal: controller.signal,
          closeSession
        })
        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Save' }))
        await screen.findByRole('button', { name: 'Saving' })
        controller.abort()
        oldHeader.unmount()
        renderHeader()
        mockStore.brushVisible = false
        settle(resolve, reject)
        await nextTick()
        expect(closeSession).not.toHaveBeenCalled()
        expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
        expect(mockStore.brushVisible).toBe(false)
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
      }
    )

    it('keeps the original session identity when the mounted header receives replacement props during save', async () => {
      let finish!: (value: 'saved' | 'cancelled') => void
      mockSaver.save.mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve
        })
      )
      const previous = new AbortController()
      const oldClose = vi.fn()
      const header = renderHeader({
        signal: previous.signal,
        closeSession: oldClose
      })
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Save' }))
      previous.abort()
      const nextClose = vi.fn()
      await header.rerender({
        signal: new AbortController().signal,
        closeSession: nextClose
      })
      finish('saved')
      await nextTick()
      expect(oldClose).not.toHaveBeenCalled()
      expect(nextClose).not.toHaveBeenCalled()
      expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
    })

    it('should restore brush + button state and log on save failure', async () => {
      mockSaver.save.mockRejectedValueOnce(new Error('save failed'))
      const user = userEvent.setup()
      renderHeader()

      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(mockStore.brushVisible).toBe(true)
      expect(console.error).toHaveBeenCalledWith(
        '[TopBarHeader] Save failed:',
        expect.any(Error)
      )
      expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
      // After failure, the Save button reads "Save" again (not "Saving")
      expect(
        screen.getByRole('button', { name: /save/i }).textContent.trim()
      ).toBe('Save')
    })
  })

  describe('cancel', () => {
    it('should close the dialog with the global-mask-editor key', async () => {
      const user = userEvent.setup()
      renderHeader()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
        key: 'global-mask-editor'
      })
    })
  })
})
