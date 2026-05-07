import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import ConfirmationDialogContent from './ConfirmationDialogContent.vue'

type Props = ComponentProps<typeof ConfirmationDialogContent>

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

describe('ConfirmationDialogContent', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function renderComponent(props: Partial<Props> = {}) {
    return render(ConfirmationDialogContent, {
      global: {
        plugins: [PrimeVue, i18n]
      },
      props: {
        message: 'Test message',
        type: 'default',
        onConfirm: vi.fn(),
        ...props
      } as Props
    })
  }

  it('renders long messages without breaking layout', () => {
    const longFilename =
      'workflow_checkpoint_' + 'a'.repeat(200) + '.safetensors'
    renderComponent({ message: longFilename })
    expect(screen.getByText(longFilename)).toBeInTheDocument()
  })

  it('omits the Cancel button when type is dirtyClose', () => {
    renderComponent({ type: 'dirtyClose' })
    expect(screen.queryByText('g.cancel')).not.toBeInTheDocument()
    expect(screen.getByText('g.save')).toBeInTheDocument()
  })

  it('uses the provided denyLabel for the deny button on dirtyClose', () => {
    renderComponent({ type: 'dirtyClose', denyLabel: 'Sign out anyway' })
    expect(screen.getByText('Sign out anyway')).toBeInTheDocument()
    expect(screen.queryByText('g.no')).not.toBeInTheDocument()
  })

  it('calls onConfirm(false) when deny is clicked on dirtyClose', async () => {
    const onConfirm = vi.fn()
    renderComponent({
      type: 'dirtyClose',
      denyLabel: 'Close anyway',
      onConfirm
    })

    await userEvent.click(screen.getByRole('button', { name: 'Close anyway' }))

    expect(onConfirm).toHaveBeenCalledWith(false)
  })

  it('calls onConfirm(true) when save is clicked on dirtyClose', async () => {
    const onConfirm = vi.fn()
    renderComponent({ type: 'dirtyClose', onConfirm })

    await userEvent.click(screen.getByRole('button', { name: 'g.save' }))

    expect(onConfirm).toHaveBeenCalledWith(true)
  })

  it('falls back to "no" label when denyLabel is not provided', () => {
    renderComponent({ type: 'dirtyClose' })
    expect(screen.getByText('g.no')).toBeInTheDocument()
  })
})
