// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import CareersSection from './CareersSection.vue'

const careersHref = () =>
  screen
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'))
    .find((href) => href?.includes('/careers'))

describe('CareersSection', () => {
  it('keeps a Chinese reader in their locale', () => {
    render(CareersSection, { props: { locale: 'zh-CN' } })

    expect(careersHref()).toBe('/zh-CN/careers')
  })

  /**
   * Japanese publishes six routes and `/careers` is not among them, so the
   * prefixed URL would be a page held back from indexing. `localizeHref`
   * answers that by leaving the path English, and the component has to pass its
   * locale through for that answer to be reached at all — hardcoding the href,
   * or dropping the prop, would send every reader to the same place and look
   * correct in English review.
   */
  it('sends a Japanese reader to the English page, which is the one that exists', () => {
    render(CareersSection, { props: { locale: 'ja' } })

    expect(careersHref()).toBe('/careers')
  })
})
