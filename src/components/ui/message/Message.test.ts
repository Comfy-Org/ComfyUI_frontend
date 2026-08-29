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
  it('announces errors as alerts', () => {
    render(Message, {
      props: { severity: 'error' },
      slots: { default: 'Could not save' },
      global: { plugins: [i18n] }
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Could not save')
  })

  it('dismisses a closable message and emits close', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(Message, {
      props: { closable: true, onClose },
      slots: { default: 'Helpful information' },
      global: { plugins: [i18n] }
    })

    await user.click(screen.getByRole('button'))

    expect(screen.queryByText('Helpful information')).not.toBeInTheDocument()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
