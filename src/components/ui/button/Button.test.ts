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

  // The label stays in the accessibility tree while loading, so the control is
  // still announced by name rather than as an unlabelled button.
  it('swaps slot content for a spinner without disabling focus while loading', () => {
    const { container } = render(Button, {
      props: { loading: true },
      slots: { default: 'Submit' }
    })

    const button = screen.getByRole('button', { name: 'Submit' })
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAttribute('aria-busy', 'true')
    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue spinner icon has no accessible role
    expect(container.querySelector('.pi-spin')).toBeInTheDocument()
  })

  it('preserves keyboard focus when loading begins and ends', async () => {
    const { rerender } = render(Button, {
      slots: { default: 'Submit' },
      props: { loading: false }
    })

    const button = screen.getByRole('button', { name: 'Submit' })
    button.focus()
    expect(button).toHaveFocus()

    await rerender({ loading: true })
    expect(button).toHaveFocus()
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')

    await rerender({ loading: false })
    expect(button).toHaveFocus()
    expect(button).not.toHaveAttribute('aria-disabled')
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

  it('blocks keyboard activation while loading', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(Button, {
      props: { loading: true },
      attrs: { onClick },
      slots: { default: 'Submit' }
    })

    const button = screen.getByRole('button', { name: 'Submit' })
    button.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(onClick).not.toHaveBeenCalled()
    expect(button).toHaveFocus()
  })

  it('allows activation again after loading ends', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { rerender } = render(Button, {
      props: { loading: true },
      attrs: { onClick },
      slots: { default: 'Submit' }
    })

    const button = screen.getByRole('button', { name: 'Submit' })
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()

    await rerender({ loading: false })
    await user.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('prevents navigation through an anchor while loading', () => {
    const onClick = vi.fn()
    render(Button, {
      props: { as: 'a', loading: true },
      attrs: { href: '#destination', onClick },
      slots: { default: 'Open' }
    })

    const link = screen.getByRole('link', { name: 'Open' })
    expect(link).toHaveAttribute('aria-disabled', 'true')
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    expect(link.dispatchEvent(click)).toBe(false)
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

    // oxlint-disable-next-line testing-library/no-node-access -- root element tag is the contract under test
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
