import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import { useDialogStore } from '@/stores/dialogStore'
import ConfirmationDialogContent from './ConfirmationDialogContent.vue'

type Props = ComponentProps<typeof ConfirmationDialogContent>

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        cancel: 'Cancel',
        confirm: 'Confirm',
        delete: 'Delete',
        overwrite: 'Overwrite',
        save: 'Save',
        no: 'No',
        ok: 'OK',
        close: 'Close'
      },
      desktopMenu: {
        reinstall: 'Reinstall'
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

describe('ConfirmationDialogContent', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function renderComponent(props: Partial<Props> = {}) {
    const user = userEvent.setup()
    render(ConfirmationDialogContent, {
      global: { plugins: [i18n] },
      props: {
        message: 'Test message',
        type: 'default',
        onConfirm: vi.fn(),
        ...props
      } as Props
    })
    return { user }
  }

  it('renders long messages without breaking layout', () => {
    const longFilename =
      'workflow_checkpoint_' + 'a'.repeat(200) + '.safetensors'
    renderComponent({ message: longFilename })
    expect(screen.getByText(longFilename)).toBeInTheDocument()
  })

  it('renders the hint as a status alert when provided', () => {
    renderComponent({ hint: 'This action cannot be undone.' })
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('This action cannot be undone.')
  })

  it('does not render a status alert when hint is omitted', () => {
    renderComponent()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  describe('button surface per type', () => {
    it("type='default' renders Cancel and Confirm", () => {
      renderComponent({ type: 'default' })
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Confirm' })
      ).toBeInTheDocument()
    })

    it("type='delete' renders Cancel and Delete", () => {
      renderComponent({ type: 'delete' })
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    it("type='overwrite' renders Cancel and Overwrite", () => {
      renderComponent({ type: 'overwrite' })
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Overwrite' })
      ).toBeInTheDocument()
    })

    it("type='dirtyClose' renders Cancel, No, and Save", () => {
      renderComponent({ type: 'dirtyClose' })
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    })

    it("type='info' renders only OK (no Cancel)", () => {
      renderComponent({ type: 'info' })
      expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Cancel' })
      ).not.toBeInTheDocument()
    })
  })

  it('confirm callback receives true and closes the dialog', async () => {
    const onConfirm = vi.fn()
    const { user } = renderComponent({ type: 'default', onConfirm })
    const closeSpy = vi.spyOn(useDialogStore(), 'closeDialog')

    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledWith(true)
    expect(closeSpy).toHaveBeenCalledOnce()
  })
})
