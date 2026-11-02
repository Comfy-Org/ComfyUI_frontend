import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useZipTieToolStore } from './zipTieToolStore'

import ZipTieToolButton from './ZipTieToolButton.vue'

function renderButton() {
  render(ZipTieToolButton, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
}

describe('Zip tie tool button', () => {
  it('shows its label and toggles the tool through its command', async () => {
    const tool = useZipTieToolStore()
    useCommandStore().registerCommand({
      id: 'Comfy.Canvas.ToggleZipTieTool',
      function: tool.toggle
    })
    renderButton()
    const button = screen.getByRole('button', { name: 'Zip tie' })
    expect(button).toHaveTextContent('Zip tie')
    expect(button).toHaveAttribute('aria-pressed', 'false')

    await userEvent.setup().click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')

    await userEvent.setup().click(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('is disabled on a read-only canvas', () => {
    useCanvasStore().isReadOnly = true
    renderButton()

    expect(screen.getByRole('button', { name: 'Zip tie' })).toBeDisabled()
  })
})
