import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import Badge from './Badge.vue'

describe('Badge', () => {
  it('requires a remove label only when removable', () => {
    type Props = InstanceType<typeof Badge>['$props']

    expectTypeOf<Record<string, never>>().toExtend<Props>()
    expectTypeOf<{ removable: false }>().toExtend<Props>()
    expectTypeOf<{
      removable: true
      removeLabel: string
    }>().toExtend<Props>()
    expectTypeOf<{ removable: true }>().not.toExtend<Props>()
  })

  it('renders its content', () => {
    render(Badge, {
      props: { variant: 'badge' },
      slots: { default: '12' }
    })

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps caller colors without losing the badge text size', () => {
    render(Badge, {
      props: {
        variant: 'badge',
        class: 'bg-green-500 text-white',
        removable: false
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
