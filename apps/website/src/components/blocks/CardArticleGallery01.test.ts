// @vitest-environment happy-dom
import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import CardArticleGallery01 from './CardArticleGallery01.vue'

describe('CardArticleGallery01', () => {
  it('merges the class prop onto the root section alongside its base layout classes', () => {
    const { container } = render(CardArticleGallery01, {
      props: { items: [], class: 'custom-spacing' }
    })

    // The root <section> carries no ARIA name, so reach it directly.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const section = container.querySelector('section')
    expect(section).toBeTruthy()
    expect(section?.classList.contains('custom-spacing')).toBe(true)
    expect(section?.classList.contains('max-w-9xl')).toBe(true)
    expect(section?.classList.contains('px-6')).toBe(true)
  })
})
