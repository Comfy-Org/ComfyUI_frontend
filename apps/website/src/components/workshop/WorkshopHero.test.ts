import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import WorkshopHero from './WorkshopHero.vue'

function renderHero(props: Record<string, unknown> = {}) {
  return render(WorkshopHero, {
    props,
    slots: { aside: '<button data-testid="aside">Browse all</button>' }
  })
}

describe('WorkshopHero', () => {
  it('names the page from the heading it was given', () => {
    renderHero()

    expect(
      screen.getByRole('heading', { name: t('workshop.hero.heading', 'en') })
    ).toBeTruthy()
  })

  it('carries a subtitle only when one is asked for', () => {
    const { unmount } = renderHero({ subtitleKey: 'workshop.meta.description' })
    expect(screen.getByTestId('workshop-hero-subtitle').textContent).toContain(
      'Browse and run'
    )
    unmount()

    renderHero()
    expect(screen.queryByTestId('workshop-hero-subtitle')).toBeNull()
  })

  it('keeps the aside at the end of the row once the subtitle is gone', () => {
    // Alone in the row, a justify-between child falls to the left edge, and
    // the aside is where Browse all lives.
    const { unmount } = renderHero({ subtitleKey: 'workshop.meta.description' })
    expect(screen.getByTestId('workshop-hero-row')).toHaveClass(
      'justify-between'
    )
    expect(screen.getByTestId('aside')).toBeVisible()
    unmount()

    renderHero()
    expect(screen.getByTestId('workshop-hero-row')).toHaveClass('justify-end')
    expect(screen.getByTestId('aside')).toBeVisible()
  })
})
