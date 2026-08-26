// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SiteFooter from './SiteFooter.vue'

describe('SiteFooter', () => {
  it('links the Models showcase page at its canonical English path', () => {
    render(SiteFooter, { props: { locale: 'en' } })

    const links = screen.getAllByRole('link', { name: 'Models' })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('/models')
    }
  })

  it('links the localized Models showcase page for zh-CN', () => {
    render(SiteFooter, { props: { locale: 'zh-CN' } })

    const links = screen.getAllByRole('link', { name: '模型' })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('/zh-CN/models')
    }
  })
})
