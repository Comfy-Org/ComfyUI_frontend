import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import Badge from './Badge.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { remove: 'Remove' } } }
})

describe('Badge', () => {
  it('renders its content', () => {
    render(Badge, {
      props: { variant: 'badge' },
      slots: { default: '12' },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('keeps caller colors without losing the badge text size', () => {
    render(Badge, {
      props: { variant: 'badge', class: 'bg-green-500 text-white' },
      slots: { default: 'Input' },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Input')).toHaveClass(
      'bg-green-500',
      'text-white',
      'text-xs'
    )
    expect(screen.getByText('Input')).not.toHaveClass(
      'bg-secondary-background',
      'text-base-foreground'
    )
  })

  it('emits remove from a removable chip', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(Badge, {
      props: { variant: 'chip', removable: true, onRemove },
      slots: { default: 'Filter' },
      global: { plugins: [i18n] }
    })

    await user.tab()
    expect(screen.getByRole('button', { name: 'Remove' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onRemove).toHaveBeenCalledOnce()
  })
})
