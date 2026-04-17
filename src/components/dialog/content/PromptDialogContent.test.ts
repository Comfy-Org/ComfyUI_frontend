import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import PromptDialogContent from './PromptDialogContent.vue'

type Props = ComponentProps<typeof PromptDialogContent>

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

describe('PromptDialogContent', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function renderComponent(props: Partial<Props> = {}) {
    const user = userEvent.setup()
    render(PromptDialogContent, {
      global: { plugins: [i18n] },
      props: {
        message: 'Enter a name',
        defaultValue: '',
        onConfirm: vi.fn(),
        ...props
      } as Props
    })
    return { user }
  }

  it('pre-fills the input with defaultValue', () => {
    renderComponent({ defaultValue: 'my workflow' })
    expect(screen.getByRole('textbox')).toHaveValue('my workflow')
  })

  it('calls onConfirm with the current input value when Confirm is clicked', async () => {
    const onConfirm = vi.fn()
    const { user } = renderComponent({ defaultValue: 'original', onConfirm })

    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'renamed')
    await user.click(screen.getByRole('button'))

    expect(onConfirm).toHaveBeenCalledWith('renamed')
  })

  it('calls onConfirm when Enter is pressed inside the input', async () => {
    const onConfirm = vi.fn()
    const { user } = renderComponent({ defaultValue: 'original', onConfirm })

    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'via enter')
    await user.keyboard('{Enter}')

    expect(onConfirm).toHaveBeenCalledWith('via enter')
  })
})
