import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { captureRouterRoadmapCardExpanded } from '../../scripts/posthog'
import RouterRoadmapSection from './RouterRoadmapSection.vue'

vi.mock(import('../../scripts/posthog'))

describe('RouterRoadmapSection', () => {
  it('links to the Router documentation with one section-level call to action', () => {
    render(RouterRoadmapSection, { props: { locale: 'en' } })

    expect(screen.getAllByRole('link', { name: 'LEARN MORE' })).toHaveLength(1)
  })

  it('expands one card on its own and reports the expansion once', async () => {
    render(RouterRoadmapSection, { props: { locale: 'en' } })
    const workflows = screen.getByRole('button', {
      name: /read more.*comfy workflows/i
    })
    const strategies = screen.getByRole('button', {
      name: /read more.*routing strategies/i
    })

    await userEvent.click(workflows)

    expect(workflows.getAttribute('aria-expanded')).toBe('true')
    expect(strategies.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText(/Workflows run today/)).toBeVisible()
    expect(screen.getByText(/Name the outcome you want/)).not.toBeVisible()
    expect(captureRouterRoadmapCardExpanded).toHaveBeenCalledExactlyOnceWith(
      'workflow'
    )

    await userEvent.click(
      screen.getByRole('button', { name: /read less.*comfy workflows/i })
    )

    expect(workflows.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText(/Workflows run today/)).not.toBeVisible()
    expect(captureRouterRoadmapCardExpanded).toHaveBeenCalledTimes(1)
  })

  it('names the panel each toggle controls', () => {
    render(RouterRoadmapSection, { props: { locale: 'en' } })
    const cards = [
      { title: /comfy workflows/i, details: /Workflows run today/ },
      { title: /routing strategies/i, details: /Name the outcome you want/ },
      { title: /route by use case/i, details: /Describe the task instead/ },
      { title: /byok/i, details: /Connect your own provider credentials/ }
    ]

    for (const card of cards) {
      const button = screen.getByRole('button', { name: card.title })
      expect(
        screen.getByText(card.details, {
          selector: `#${button.getAttribute('aria-controls')} *`
        })
      ).toBeTruthy()
    }
  })
})
