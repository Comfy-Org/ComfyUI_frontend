import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import ChatOpeningPane from './ChatOpeningPane.vue'

describe('ChatOpeningPane', () => {
  it('names the chat that is opening', () => {
    render(ChatOpeningPane, {
      props: { status: 'loading', title: 'Fox portrait' },
      global: { plugins: [i18n] }
    })

    expect(screen.getByRole('status')).toHaveTextContent('Opening Fox portrait')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('offers a retry and a way back when the chat could not open', async () => {
    const view = render(ChatOpeningPane, {
      props: { status: 'failed', title: 'Fox portrait' },
      global: { plugins: [i18n] }
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not open this chat'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Back to previous chat' })
    )

    expect(view.emitted().retry).toHaveLength(1)
    expect(view.emitted().back).toHaveLength(1)
  })
})
