import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import Message from './Message.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { close: 'Close' } } }
})

describe('Message', () => {
  it.for(['error', 'warn', 'info'] as const)(
    'announces %s messages as alerts',
    (severity) => {
      render(Message, {
        props: { severity },
        slots: { default: 'Could not save' },
        global: { plugins: [i18n] }
      })

      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Could not save')
      expect(alert).toHaveAttribute('aria-live', 'assertive')
      expect(alert).toHaveAttribute('aria-atomic', 'true')
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    }
  )

  it('dismisses a closable message and emits close', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(Message, {
      props: { closable: true, onClose },
      slots: { default: 'Helpful information' },
      global: { plugins: [i18n] }
    })

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByText('Helpful information')).not.toBeInTheDocument()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
