import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'

import AgentConsentCard from './AgentConsentCard.vue'

const props = {
  title: 'Meet Comfy Agent',
  titleId: 'agent-consent',
  paragraphs: ['First paragraph.', 'Second paragraph.']
}

function renderCard(
  overrides: Partial<ComponentProps<typeof AgentConsentCard>> = {}
) {
  return render(AgentConsentCard, {
    props: { ...props, ...overrides },
    global: { plugins: [i18n] }
  })
}

describe('AgentConsentCard', () => {
  it('labels the supplied copy for its parent dialog', () => {
    renderCard()

    expect(screen.getByRole('heading', { name: props.title })).toHaveAttribute(
      'id',
      props.titleId
    )
    for (const paragraph of props.paragraphs) {
      expect(screen.getByText(paragraph)).toBeInTheDocument()
    }
  })

  it('emits the decision made by the user', async () => {
    const user = userEvent.setup()
    const { emitted } = renderCard()

    await user.click(
      screen.getByRole('button', { name: 'Start using Comfy Agent' })
    )
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))

    expect(emitted().accept).toHaveLength(1)
    expect(emitted().reject).toHaveLength(1)
  })

  it('shows only the busy Start action while acceptance is being saved', () => {
    renderCard({ accepting: true })

    expect(
      screen.getByRole('button', { name: 'Start using Comfy Agent' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Start using Comfy Agent' })
    ).toHaveAttribute('aria-busy', 'true')
    expect(
      screen.queryByRole('button', { name: 'Skip for now' })
    ).not.toBeInTheDocument()
  })

  it('announces a persistence error and lets the user retry', () => {
    renderCard({ error: 'Could not save your preference. Try again.' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not save your preference. Try again.'
    )
    expect(
      screen.getByRole('button', { name: 'Start using Comfy Agent' })
    ).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeEnabled()
  })

  it('shows a placeholder when no video is supplied', () => {
    renderCard()

    expect(screen.getByText('Video unavailable')).toBeInTheDocument()
  })

  it('falls back to the placeholder when the video fails to load', async () => {
    renderCard({ videoSrc: 'https://example.test/a.mp4' })
    expect(screen.queryByText('Video unavailable')).not.toBeInTheDocument()

    await fireEvent.error(screen.getByTestId('agent-consent-video'))

    expect(screen.getByText('Video unavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('agent-consent-video')).not.toBeInTheDocument()
  })
})
