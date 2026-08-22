import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import AgentConsentCard from './AgentConsentCard.vue'

const props = {
  title: 'Let the agent edit your workflow',
  paragraphs: ['First paragraph.', 'Second paragraph.']
}

function renderCard(overrides: Record<string, unknown> = {}) {
  return render(AgentConsentCard, {
    props: { ...props, ...overrides },
    global: { plugins: [i18n] }
  })
}

describe('AgentConsentCard', () => {
  it('renders the supplied copy as separate paragraphs', () => {
    renderCard()

    expect(screen.getByRole('heading', { name: props.title })).toBeTruthy()
    for (const paragraph of props.paragraphs) {
      expect(screen.getByText(paragraph)).toBeTruthy()
    }
  })

  it('emits the decision made by the reader', async () => {
    const user = userEvent.setup()
    const { emitted } = renderCard()

    await user.click(screen.getByRole('button', { name: 'Accept' }))
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(emitted().accept).toHaveLength(1)
    expect(emitted().reject).toHaveLength(1)
    expect(emitted().close).toHaveLength(1)
  })

  it('falls back to a placeholder when no video is supplied', () => {
    renderCard()

    expect(screen.getByText('Video unavailable')).toBeTruthy()
  })
})
