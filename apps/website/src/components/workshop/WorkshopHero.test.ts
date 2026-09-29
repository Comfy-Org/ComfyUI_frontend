import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkshopHero from './WorkshopHero.vue'

function renderHero(subtitle?: string) {
  return render(WorkshopHero, {
    props: { eyebrow: 'Models', heading: 'What will you make next?', subtitle },
    slots: { aside: '<button data-testid="aside">Browse all</button>' }
  })
}

describe('WorkshopHero', () => {
  it('names the page from the heading it was given', () => {
    renderHero()

    expect(
      screen.getByRole('heading', { name: 'What will you make next?' })
    ).toBeTruthy()
  })

  // SplitReveal gives each word its own element, so the subtitle is read one
  // word at a time rather than as a sentence.
  it('carries a subtitle only when one is asked for', () => {
    const { unmount } = renderHero('Browse and run the latest models')
    expect(screen.getByText('Browse')).toBeVisible()
    unmount()

    renderHero()
    expect(screen.queryByText('Browse')).toBeNull()
  })

  // The live catalogue puts its tabs where the eyebrow goes, so a section that
  // fills the slot replaces the line rather than sitting under it.
  it('gives the eyebrow line up to whatever fills its slot', () => {
    render(WorkshopHero, {
      props: { eyebrow: 'Models', heading: 'What will you make next?' },
      slots: { eyebrow: '<nav data-testid="tabs">Models · Workflows</nav>' }
    })

    expect(screen.getByTestId('tabs')).toBeVisible()
    expect(screen.queryByText('Models', { selector: 'p *' })).toBeNull()
  })
})
