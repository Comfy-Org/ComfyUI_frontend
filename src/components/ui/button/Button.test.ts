import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Button from './Button.vue'

describe('Button', () => {
  it('renders slot content inside a button by default', () => {
    render(Button, {
      slots: { default: 'Click me' }
    })

    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('fires click events when enabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(Button, {
      slots: { default: 'Click me' },
      attrs: { onClick }
    })

    await user.click(screen.getByRole('button', { name: 'Click me' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('hides slot content, shows a spinner, and disables the button while loading', () => {
    const { container } = render(Button, {
      props: { loading: true },
      slots: { default: 'Submit' }
    })

    expect(screen.queryByText('Submit')).not.toBeInTheDocument()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue spinner icon has no accessible role
    expect(container.querySelector('.pi-spin')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('does not fire click when loading', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(Button, {
      props: { loading: true },
      attrs: { onClick }
    })

    await user.click(screen.getByRole('button'))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('disables the button when disabled prop is true', () => {
    render(Button, {
      props: { disabled: true },
      slots: { default: 'Nope' }
    })

    expect(screen.getByRole('button', { name: 'Nope' })).toBeDisabled()
  })

  it('renders as an anchor when as="a"', () => {
    const { container } = render(Button, {
      props: { as: 'a' },
      slots: { default: 'Link' }
    })

    // eslint-disable-next-line testing-library/no-node-access -- root element tag is the contract under test
    const root = container.firstElementChild
    expect(root?.tagName).toBe('A')
  })

  it('applies variant classes through buttonVariants', () => {
    render(Button, {
      props: { variant: 'primary' },
      slots: { default: 'Primary' }
    })

    expect(screen.getByRole('button', { name: 'Primary' })).toHaveClass(
      'bg-primary-background'
    )
  })
})
