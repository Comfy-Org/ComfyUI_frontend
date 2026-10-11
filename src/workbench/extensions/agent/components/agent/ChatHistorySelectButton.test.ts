import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

import { i18n } from '@/i18n'

import ChatHistorySelectButton from './ChatHistorySelectButton.vue'

describe('ChatHistorySelectButton', () => {
  it('announces loading outside the disabled button and allows selection when ready', async () => {
    const { emitted, rerender } = render(ChatHistorySelectButton, {
      props: { title: 'Portrait chat', loading: true },
      global: { plugins: [i18n] }
    })
    const button = screen.getByRole('button', { name: 'Portrait chat' })

    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(within(button).queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      i18n.global.t('g.loading')
    )

    await rerender({ loading: false })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(button).toBeEnabled()
    await userEvent.click(button)
    expect(emitted().select).toEqual([[]])
  })

  it('describes the failed chat with an external alert and clears it on retry', async () => {
    const { rerender } = render(ChatHistorySelectButton, {
      props: { title: 'Portrait chat', failed: true },
      global: { plugins: [i18n] }
    })
    const button = screen.getByRole('button', { name: 'Portrait chat' })

    expect(button).toHaveAccessibleDescription(
      i18n.global.t('agent.historyOpenFailed')
    )
    expect(within(button).queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      i18n.global.t('agent.historyOpenFailed')
    )
    expect(button).toBeEnabled()

    await rerender({ failed: false, loading: true })

    expect(button).not.toHaveAccessibleDescription()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('keeps each failed row associated with its own error', async () => {
    const { rerender } = render(
      defineComponent({
        components: { ChatHistorySelectButton },
        props: { firstFailed: { type: Boolean, default: true } },
        template: `
          <ChatHistorySelectButton title="Portrait chat" :failed="firstFailed" />
          <ChatHistorySelectButton title="Landscape chat" failed />
        `
      }),
      { global: { plugins: [i18n] } }
    )
    const first = screen.getByRole('button', { name: 'Portrait chat' })
    const second = screen.getByRole('button', { name: 'Landscape chat' })

    expect(first).toHaveAccessibleDescription(
      i18n.global.t('agent.historyOpenFailed')
    )
    expect(second).toHaveAccessibleDescription(
      i18n.global.t('agent.historyOpenFailed')
    )
    expect(first.getAttribute('aria-describedby')).not.toBe(
      second.getAttribute('aria-describedby')
    )

    await rerender({ firstFailed: false })

    expect(first).not.toHaveAccessibleDescription()
    expect(second).toHaveAccessibleDescription(
      i18n.global.t('agent.historyOpenFailed')
    )
  })
})
