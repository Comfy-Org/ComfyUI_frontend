import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'

import SessionReconnecting from './SessionReconnecting.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

describe('SessionReconnecting', () => {
  it('renders nothing while the session is not reconnecting', () => {
    render(SessionReconnecting, { global: { plugins: [i18n] } })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('offers a retry that reloads the page while reconnecting', async () => {
    const reload = vi
      .spyOn(window.location, 'reload')
      .mockImplementation(() => {})
    useCloudWebSessionStore().reconnecting = true
    render(SessionReconnecting, { global: { plugins: [i18n] } })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Reconnecting to your account'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Retry now' }))

    expect(reload).toHaveBeenCalledOnce()
  })
})
