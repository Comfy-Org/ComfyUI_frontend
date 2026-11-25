import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'
import { openFeedbackDialog } from '@/workbench/extensions/agent/feedback'

import AgentConsentCard from './AgentConsentCard.vue'

vi.mock(import('@/workbench/extensions/agent/feedback'), () => ({
  openFeedbackDialog: vi.fn()
}))

const props = {
  title: 'Meet Comfy Agent',
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

    expect(
      screen.getByRole('heading', { name: props.title })
    ).toBeInTheDocument()
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

  it('ties the next sign-in step to the continue action', async () => {
    const user = userEvent.setup()
    const { emitted } = renderCard({ requiresSignIn: true })

    const accept = screen.getByRole('button', {
      name: 'Agree and continue with sign in'
    })
    expect(accept).not.toHaveAccessibleDescription()
    expect(screen.queryByText("You'll sign in next.")).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Start using Comfy Agent' })
    ).not.toBeInTheDocument()

    await user.click(accept)
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

  it.for([
    { kind: 'save' as const, title: "Couldn't start Comfy Agent" },
    { kind: 'load' as const, title: "Couldn't load your Agent settings" },
    { kind: 'signIn' as const, title: "Couldn't open sign-in" }
  ])('announces a $kind failure as an inline toast', ({ kind, title }) => {
    renderCard({ error: kind })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(title)
    expect(alert).toHaveTextContent(
      'Please check your connection and try again. If you continue having issues, please use the contact form.'
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Start using Comfy Agent' })
    ).not.toBeInTheDocument()
  })

  it('opens the agent feedback form from the contact form link', async () => {
    const user = userEvent.setup()
    renderCard({ error: 'save' })

    await user.click(screen.getByRole('button', { name: 'contact form' }))

    expect(openFeedbackDialog).toHaveBeenCalledWith('agent-consent')
  })

  it('dismisses the toast and keeps the retry action', async () => {
    const user = userEvent.setup()
    renderCard({ error: 'save' })

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeEnabled()
  })

  it('retries accept from Try again after a failed save', async () => {
    const user = userEvent.setup()
    const { emitted } = renderCard({
      error: 'save'
    })

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(emitted().accept).toHaveLength(1)
  })

  it('uses Try again for a signed-out save failure', async () => {
    const user = userEvent.setup()
    const { emitted } = renderCard({
      requiresSignIn: true,
      error: 'save'
    })

    expect(
      screen.queryByRole('button', {
        name: 'Agree and continue with sign in'
      })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(emitted().accept).toHaveLength(1)
  })

  it('shows the toast again when a new error arrives', async () => {
    const user = userEvent.setup()
    const { rerender } = renderCard({
      error: 'save'
    })

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await rerender({ ...props, error: '' })
    await rerender({
      ...props,
      error: 'save'
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't start Comfy Agent"
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
  })

  it('provides a native documentation link that opens safely in a new tab', () => {
    renderCard({ docsUrl: 'https://docs.comfy.org/agent-tools/in-app-agent' })
    const docs = screen.getByRole('link', { name: 'Read the docs' })
    expect(docs).toHaveAttribute(
      'href',
      'https://docs.comfy.org/agent-tools/in-app-agent'
    )
    expect(docs).toHaveAttribute('target', '_blank')
    expect(docs).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('puts Skip before Start when the card is wide', () => {
    renderCard({ docsUrl: 'https://docs.comfy.org/agent-tools/in-app-agent' })

    expect(
      screen.getAllByRole('button').map((button) => button.textContent)
    ).toEqual(['Skip for now', 'Start using Comfy Agent'])
  })

  it('shows a placeholder when no video is supplied', () => {
    renderCard()

    expect(screen.getByText('Video unavailable')).toBeInTheDocument()
  })

  it('falls back to the placeholder when the video fails to load', async () => {
    renderCard({
      videoSources: [{ src: 'https://example.test/a.mp4', type: 'video/mp4' }]
    })
    expect(screen.queryByText('Video unavailable')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Play' })
    ).not.toBeInTheDocument()

    await fireEvent.error(screen.getByTestId('agent-consent-video'))

    expect(screen.getByText('Video unavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('agent-consent-video')).not.toBeInTheDocument()
  })
})
