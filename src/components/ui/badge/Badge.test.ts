import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import Badge from './Badge.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { remove: 'Remove' } } }
})

describe('Badge', () => {
  it('renders a value', () => {
    render(Badge, {
      props: { value: 12, variant: 'badge' },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('emits remove from a removable chip', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(Badge, {
      props: { variant: 'chip', removable: true, onRemove },
      slots: { default: 'Filter' },
      global: { plugins: [i18n] }
    })

    await user.click(screen.getByRole('button'))

    expect(onRemove).toHaveBeenCalledOnce()
  })
})
