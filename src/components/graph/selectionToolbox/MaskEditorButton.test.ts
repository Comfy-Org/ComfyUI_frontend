import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import MaskEditorButton from '@/components/graph/selectionToolbox/MaskEditorButton.vue'
import { useCommandStore } from '@/stores/commandStore'

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  messages: {
    en: {
      commands: {
        Comfy_MaskEditor_OpenMaskEditor: { label: 'Open in Mask Editor' }
      }
    }
  }
})

const renderButton = () =>
  render(MaskEditorButton, {
    global: {
      plugins: [i18n]
    }
  })

describe('MaskEditorButton', () => {
  it('should render with the localized aria-label', () => {
    renderButton()

    expect(
      screen.getByRole('button', { name: 'Open in Mask Editor' })
    ).toBeInTheDocument()
  })

  it('should execute the OpenMaskEditor command on click', async () => {
    const user = userEvent.setup()
    const openMaskEditor = vi.fn()
    useCommandStore().registerCommand({
      id: 'Comfy.MaskEditor.OpenMaskEditor',
      function: openMaskEditor
    })
    renderButton()

    await user.click(
      screen.getByRole('button', { name: 'Open in Mask Editor' })
    )

    expect(openMaskEditor).toHaveBeenCalledOnce()
  })
})
