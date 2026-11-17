import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { messages } from './messages'
import ThinkingDock from './ThinkingDock.vue'

const baseProps: ComponentProps<typeof ThinkingDock> = {
  thinking: {
    requestId: 'request-1',
    text: 'Looking at the workflow.\nThe width is on Empty Latent Image.',
    done: false
  },
  tall: false,
  cap: 240,
  canCancel: true
}

function renderDock(props: Partial<ComponentProps<typeof ThinkingDock>> = {}) {
  return render(ThinkingDock, { props: { ...baseProps, ...props } })
}

describe('ThinkingDock', () => {
  it('BA-05: shows the thinking as it has arrived, in a body of fixed height', () => {
    renderDock()

    const body = screen.getByRole('log', { name: messages.thinking })
    expect(body).toHaveTextContent(/Looking at the workflow\.\s+The width is/)
    expect(body).toHaveClass('h-16')
    expect(body).not.toHaveAttribute('style')
  })

  it('BA-07: says it is thinking before the first word arrives', () => {
    renderDock({ thinking: { ...baseProps.thinking, text: '' } })

    expect(screen.getByRole('log')).toHaveTextContent(messages.askWaiting)
  })

  it('BA-10: says so when the model returned no thinking', () => {
    renderDock({ thinking: { ...baseProps.thinking, text: '', done: true } })

    expect(screen.getByRole('log')).toHaveTextContent(messages.noThinking)
  })

  it('BA-11: grows to the cap when made taller', () => {
    renderDock({ tall: true, cap: 240 })

    expect(screen.getByRole('log')).toHaveStyle({ height: '240px' })
    expect(
      screen.getByRole('button', { name: messages.thinkingShorter })
    ).toBeVisible()
  })

  it('BA-05: has Cancel while its request waits, and not afterwards', async () => {
    const user = userEvent.setup()
    const { emitted, rerender } = renderDock()

    await user.click(screen.getByRole('button', { name: messages.cancel }))
    expect(emitted('cancel')).toHaveLength(1)

    await rerender({ canCancel: false })
    expect(
      screen.queryByRole('button', { name: messages.cancel })
    ).not.toBeInTheDocument()
  })

  it('BA-06, BA-11: folds and grows by its own controls', async () => {
    const user = userEvent.setup()
    const { emitted } = renderDock()

    await user.click(
      screen.getByRole('button', { name: messages.hideThinking })
    )
    await user.click(
      screen.getByRole('button', { name: messages.thinkingTaller })
    )

    expect(emitted('collapse')).toHaveLength(1)
    expect(emitted('taller')).toHaveLength(1)
  })
})
