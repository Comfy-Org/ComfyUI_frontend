import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import Message from './Message.vue'

describe('Message', () => {
  it.for(['error', 'warning', 'info'] as const)(
    'announces %s messages as alerts',
    (severity) => {
      render(Message, {
        props: { severity },
        slots: { default: 'Could not save' }
      })

      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Could not save')
      expect(alert).toHaveAttribute('aria-live', 'assertive')
      expect(alert).toHaveAttribute('aria-atomic', 'true')
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    }
  )

  it('keeps its icon decorative', () => {
    render(Message, {
      slots: {
        default: 'Helpful information',
        icon: '<svg role="img" aria-label="Information" />'
      }
    })

    expect(screen.getByRole('img', { hidden: true })).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('dismisses a closable message and emits close', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(Message, {
      props: { closable: true, onClose, closeLabel: 'Close' },
      slots: { default: 'Helpful information' }
    })

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByText('Helpful information')).not.toBeInTheDocument()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('lets the parent show a message again after dismissal', async () => {
    const user = userEvent.setup()
    const visible = ref(false)
    render({
      components: { Message },
      setup: () => ({ visible }),
      template:
        '<Message v-model:visible="visible" close-label="Close" closable>Helpful information</Message>'
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    visible.value = true
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Helpful information'
    )

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(visible.value).toBe(false)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    visible.value = true
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Helpful information'
    )
  })
})
