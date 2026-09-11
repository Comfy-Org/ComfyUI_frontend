import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import MaskEditorButton from '@/components/graph/selectionToolbox/MaskEditorButton.vue'
import { useCommandStore } from '@/stores/commandStore'

const mockSelectionState = vi.hoisted(() => ({
  isSingleImageNode: { value: true }
}))

vi.mock<unknown>(import('@/composables/graph/useSelectionState'), () => ({
  useSelectionState: () => mockSelectionState
}))

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
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })

describe('MaskEditorButton', () => {
  beforeEach(() => {
    mockSelectionState.isSingleImageNode = ref(true)
  })

  it('should render with the localized aria-label when a single image node is selected', () => {
    renderButton()

    expect(
      screen.getByRole('button', { name: 'Open in Mask Editor' })
    ).toBeInTheDocument()
  })

  it('should hide via v-show when no single image node is selected', () => {
    mockSelectionState.isSingleImageNode = ref(false)
    renderButton()

    const btn = screen.getByLabelText('Open in Mask Editor', {
      selector: 'button'
    })
    expect(btn.getAttribute('style') ?? '').toContain('display: none')
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
