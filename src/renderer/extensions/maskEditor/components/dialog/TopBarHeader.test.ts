import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import TopBarHeader from '@/renderer/extensions/maskEditor/components/dialog/TopBarHeader.vue'
import { useDialogStore } from '@/stores/dialogStore'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'

const mockSaver = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue(undefined)
}))

vi.mock(
  import('@/renderer/extensions/maskEditor/composables/useMaskEditorSaver'),
  () => ({ useMaskEditorSaver: () => mockSaver })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { save: 'Save', saving: 'Saving', cancel: 'Cancel' },
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
  it('hides the brush, saves, and closes the dialog on success', async () => {
    const user = userEvent.setup()
    renderHeader()
    const store = useMaskEditorStore()
    store.brushVisible = true

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(store.brushVisible).toBe(false)
    expect(mockSaver.save).toHaveBeenCalledTimes(1)
    expect(useDialogStore().closeDialog).toHaveBeenCalledTimes(1)
  })

  it('shows Saving and disables Save until the host save finishes', async () => {
    let resolve = () => {}
    const promise = new Promise<void>((finish) => {
      resolve = finish
    })
    mockSaver.save.mockReturnValueOnce(promise)
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled()
    expect(useDialogStore().closeDialog).not.toHaveBeenCalled()

    resolve()
    await promise
    await vi.waitFor(() => {
      expect(useDialogStore().closeDialog).toHaveBeenCalledTimes(1)
    })
  })

  it('restores the brush and Save button without closing on save failure', async () => {
    mockSaver.save.mockRejectedValueOnce(new Error('save failed'))
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(useMaskEditorStore().brushVisible).toBe(true)
    expect(console.error).toHaveBeenCalledWith(
      '[TopBarHeader] Save failed:',
      expect.any(Error)
    )
    expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('closes the global mask editor on Cancel', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'global-mask-editor'
    })
  })
})
