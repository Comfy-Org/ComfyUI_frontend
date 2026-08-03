import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import MaskEditorButton from '@/components/graph/selectionToolbox/MaskEditorButton.vue'

const mockExecute = vi.hoisted(() => vi.fn())
const mockSelectionState = vi.hoisted(() => ({
  isSingleImageNode: { value: true }
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute: mockExecute })
}))

vi.mock('@/composables/graph/useSelectionState', () => ({
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
    vi.clearAllMocks()
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
    renderButton()

    await user.click(
      screen.getByRole('button', { name: 'Open in Mask Editor' })
    )

    expect(mockExecute).toHaveBeenCalledWith('Comfy.MaskEditor.OpenMaskEditor')
  })
})
