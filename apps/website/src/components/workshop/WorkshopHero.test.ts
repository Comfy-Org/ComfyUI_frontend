import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { t } from '../../i18n/translations'
import WorkshopHero from './WorkshopHero.vue'

type WorkshopHeroProps = ComponentProps<typeof WorkshopHero>

function renderHero(props: Partial<WorkshopHeroProps> = {}) {
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

  // SplitReveal gives each word its own element, so the subtitle is read one
  // word at a time rather than as a sentence.
  it('carries a subtitle only when one is asked for', () => {
    const { unmount } = renderHero({ subtitleKey: 'workshop.meta.description' })
    expect(screen.getByText('Browse')).toBeVisible()
    unmount()

    renderHero()
    expect(screen.queryByText('Browse')).toBeNull()
  })
})
