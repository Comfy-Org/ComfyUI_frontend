import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import DesignDecisions from './DesignDecisions.vue'

function addAnchor(anchor: string) {
  const element = document.createElement('div')
  element.dataset.designDecision = anchor
  document.body.append(element)
  onTestFinished(() => element.remove())
}

beforeEach(() => {
  vi.spyOn(navigator, 'webdriver', 'get').mockReturnValue(false)
})

describe('DesignDecisions', () => {
  it('renders nothing when disabled', () => {
    addAnchor('models-sidebar')
    render(DesignDecisions, { props: { enabled: false } })

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('stays out of the way of automated browsers', async () => {
    vi.spyOn(navigator, 'webdriver', 'get').mockReturnValue(true)
    addAnchor('models-sidebar')
    render(DesignDecisions, { props: { enabled: true } })

    await Promise.resolve()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows only the button until it is pressed, then numbers the decisions of the page in dots and the panel', async () => {
    addAnchor('models-sidebar')
    addAnchor('models-filters')
    const user = userEvent.setup()
    render(DesignDecisions, { props: { enabled: true } })

    const toggle = await screen.findByTestId('design-decisions-toggle')
    expect(toggle).toHaveTextContent('Design decisions 2')
    expect(screen.queryByTestId('design-decision-dot')).toBeNull()
    expect(screen.queryByRole('complementary')).toBeNull()

    await user.click(toggle)
    expect(
      screen.getByRole('button', { name: 'Design decision 1' })
    ).toBeTruthy()
    const panel = screen.getByRole('complementary', {
      name: 'Design decisions'
    })
    expect(
      within(panel)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual(['Sidebar by type', 'Use cases inside Filters, per type'])
    expect(panel).toHaveTextContent('analytics PR #20538')

    await user.click(screen.getByRole('button', { name: 'Design decision 2' }))
    expect(screen.getByRole('complementary')).toBeTruthy()

    await user.click(toggle)
    expect(screen.queryByTestId('design-decision-dot')).toBeNull()
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('lists the workflows decision on the workflows page', async () => {
    addAnchor('workflows-filters')
    const user = userEvent.setup()
    render(DesignDecisions, { props: { enabled: true } })

    await user.click(await screen.findByTestId('design-decisions-toggle'))
    expect(
      within(screen.getByRole('complementary'))
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual(['Categories inside Filters'])
  })
})
