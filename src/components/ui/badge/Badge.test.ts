import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Badge from './Badge.vue'

describe('Badge', () => {
  it('renders its content', () => {
    render(Badge, {
      props: { variant: 'badge', removeLabel: 'Remove' },
      slots: { default: '12' }
    })

    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('keeps caller colors without losing the badge text size', () => {
    render(Badge, {
      props: {
        variant: 'badge',
        class: 'bg-green-500 text-white',
        removeLabel: 'Remove'
      },
      slots: { default: 'Input' }
    })

    expect(screen.getByText('Input')).toHaveClass(
      'bg-green-500',
      'text-white',
      'text-xs'
    )
    expect(screen.getByText('Input')).not.toHaveClass(
      'bg-secondary',
      'text-foreground'
    )
  })

  it('emits remove from a removable chip', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    render(Badge, {
      props: {
        variant: 'chip',
        removable: true,
        onRemove,
        removeLabel: 'Remove'
      },
      slots: { default: 'Filter' }
    })

    await user.tab()
    expect(screen.getByRole('button', { name: 'Remove' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onRemove).toHaveBeenCalledOnce()
  })
})
