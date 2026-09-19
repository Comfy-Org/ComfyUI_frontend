import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { captureRouterRoadmapCardExpanded } from '../../scripts/posthog'
import RouterRoadmapSection from './RouterRoadmapSection.vue'

vi.mock(import('../../scripts/posthog'), () => ({
  captureRouterRoadmapCardExpanded: vi.fn()
}))

describe('RouterRoadmapSection', () => {
  it('links to the Router documentation with one section-level call to action', () => {
    render(RouterRoadmapSection, { props: { locale: 'en' } })

    expect(screen.getAllByRole('link', { name: 'LEARN MORE' })).toHaveLength(1)
  })

  it('expands a card into its details and reports the expansion once', async () => {
    render(RouterRoadmapSection, { props: { locale: 'en' } })
    const [readMore] = screen.getAllByRole('button', { name: /read more/i })

    await userEvent.click(readMore)

    expect(readMore.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(/Workflows run today/)).toBeTruthy()
    expect(captureRouterRoadmapCardExpanded).toHaveBeenCalledExactlyOnceWith(
      'workflow'
    )

    await userEvent.click(readMore)

    expect(readMore.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText(/Workflows run today/)).toBeNull()
    expect(captureRouterRoadmapCardExpanded).toHaveBeenCalledTimes(1)
  })
})
