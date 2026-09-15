// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import StoryCard from './StoryCard.vue'

const story = {
  slug: 'blackmath',
  title: 'BlackMath',
  category: 'Studio',
  cover: '/cover.webp',
  description: 'A studio.'
}

describe('StoryCard', () => {
  it('links into the locale that serves the route', () => {
    render(StoryCard, { props: { story, locale: 'zh-CN' } })

    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/zh-CN/customers/blackmath'
    )
  })

  /**
   * The card is rendered from a `v-for`, so Vue reuses one instance for
   * whichever story occupies that slot. A `const` evaluated once at setup keeps
   * the first story's href while the rest of the card re-renders around it,
   * which sends the reader to the wrong story — the failure is invisible in the
   * markup because every other field is correct.
   */
  it('follows the story it is given when reused for another one', async () => {
    const { rerender } = render(StoryCard, {
      props: { story, locale: 'en' }
    })

    await rerender({
      story: { ...story, slug: 'moment-factory', title: 'Moment Factory' },
      locale: 'en'
    })

    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/customers/moment-factory'
    )
  })
})
