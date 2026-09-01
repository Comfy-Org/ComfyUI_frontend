// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SiteFooter from './SiteFooter.vue'

describe('SiteFooter', () => {
  // The /models showcase page is intentionally not promoted from the footer.
  it('does not link the Models showcase page', () => {
    render(SiteFooter, { props: { locale: 'en' } })

    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(hrefs).not.toContain('/models')
  })

  it('links the MiniMax license page at its localized path for zh-CN', () => {
    render(SiteFooter, { props: { locale: 'zh-CN' } })

    const links = screen.getAllByRole('link', { name: 'MiniMax 商业许可' })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('/zh-CN/minimax/license')
    }
  })
})
