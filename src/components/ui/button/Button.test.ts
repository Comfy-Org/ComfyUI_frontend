import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import TooltipProvider from '@/components/ui/tooltip/TooltipProvider.vue'

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
  it('swaps slot content for a spinner and disables the button while loading', () => {
    const { container } = render(Button, {
      props: { loading: true },
      slots: { default: 'Submit' }
    })

    const button = screen.getByRole('button', { name: 'Submit' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- PrimeVue spinner icon has no accessible role
    expect(container.querySelector('.pi-spin')).toBeInTheDocument()
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

    // oxlint-disable-next-line testing-library/no-node-access -- root element tag is the contract under test
    const root = container.firstElementChild
    expect(root?.tagName).toBe('A')
  })

  it('shows its tooltip on keyboard focus without changing its name', async () => {
    const user = userEvent.setup()
    render({
      components: { Button, TooltipProvider },
      template: `
        <TooltipProvider>
          <Button tooltip="Delete the node" tooltip-side="bottom" aria-label="Delete">
            <i class="icon-[lucide--trash]" />
          </Button>
        </TooltipProvider>
      `
    })

    await user.tab()

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Delete the node'
    )
    expect(screen.getByTestId('tooltip-content')).toHaveAttribute(
      'data-side',
      'bottom'
    )
    expect(
      screen.getByRole('button', { name: 'Delete' })
    ).toHaveAccessibleDescription('Delete the node')
  })

  it('forwards attributes, events and focus to the button when it has a tooltip', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(Button, {
      props: { tooltip: 'Run the workflow' },
      attrs: { 'data-testid': 'run-button', 'aria-pressed': 'true', onClick },
      slots: { default: 'Run' }
    })
    const button = screen.getByRole('button', { name: 'Run' })

    await user.tab()
    expect(button).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Run the workflow'
    )

    await user.click(button)
    expect(onClick).toHaveBeenCalledOnce()
    expect(screen.getByTestId('run-button')).toBe(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the same focused button when its tooltip changes between empty and set', async () => {
    const user = userEvent.setup()
    const { rerender } = render(Button, {
      props: { tooltip: '' },
      attrs: { 'aria-label': 'Category' }
    })
    const button = screen.getByRole('button', { name: 'Category' })

    await user.tab()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await rerender({ tooltip: 'Lights' })

    expect(screen.getByRole('button', { name: 'Category' })).toBe(button)
    expect(button).toHaveFocus()
  })

  it.for([
    {
      name: 'its aria-label',
      attrs: { 'aria-label': 'Delete' },
      slot: '<i class="icon-[lucide--trash]" />',
      tooltip: 'Delete',
      description: ''
    },
    {
      name: 'its text',
      attrs: {},
      slot: 'Run',
      tooltip: 'Run',
      description: ''
    },
    {
      name: 'neither',
      attrs: {},
      slot: 'Run',
      tooltip: 'Run the workflow',
      description: 'Run the workflow'
    }
  ])(
    'describes itself with "$description" when the tooltip repeats $name',
    async ({ attrs, slot, tooltip, description }) => {
      const user = userEvent.setup()
      render(Button, { props: { tooltip }, attrs, slots: { default: slot } })

      await user.tab()

      await screen.findByRole('tooltip')
      await waitFor(() =>
        expect(screen.getByRole('button')).toHaveAccessibleDescription(
          description
        )
      )
    }
  )

  it('renders the tooltip slot in place of the tooltip text', async () => {
    const user = userEvent.setup()
    render(Button, {
      props: { tooltip: 'Send' },
      attrs: { 'aria-label': 'Send' },
      slots: { tooltip: 'Send <kbd>Enter</kbd>' }
    })

    await user.tab()

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Send Enter')
  })

  it('renders without tooltip wiring when it has no tooltip', async () => {
    const user = userEvent.setup()
    render(Button, { slots: { default: 'Plain' } })

    await user.tab()

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
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
