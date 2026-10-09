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

  it('numbers the decisions of the page it is on and opens the panel from a dot', async () => {
    addAnchor('models-sidebar')
    addAnchor('models-chips')
    const user = userEvent.setup()
    render(DesignDecisions, { props: { enabled: true } })

    expect(
      await screen.findByRole('button', { name: 'Design decision 1' })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Design decision 2' })
    ).toBeTruthy()
    expect(screen.getByTestId('design-decisions-toggle')).toHaveTextContent(
      'Design decisions 2'
    )
    expect(screen.queryByRole('complementary')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Design decision 2' }))
    const panel = screen.getByRole('complementary', {
      name: 'Design decisions'
    })
    expect(
      within(panel)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual(['Sidebar by type', 'Use-case chips inside a type'])
    expect(panel).toHaveTextContent('analytics PR #20538')
  })

  it('lists the workflows decision on the workflows page', async () => {
    addAnchor('workflows-chips')
    const user = userEvent.setup()
    render(DesignDecisions, { props: { enabled: true } })

    await user.click(await screen.findByTestId('design-decisions-toggle'))
    expect(
      within(screen.getByRole('complementary'))
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual(['Category chips'])
  })
})
