// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ModelDiscoverySection from './ModelDiscoverySection.vue'

describe('ModelDiscoverySection', () => {
  it('links every lineup model to its Workshop page once', () => {
    render(ModelDiscoverySection)

    const seedance = screen.getByRole('link', { name: /Seedance 2/ })
    expect(seedance.getAttribute('href')).toBe('/workshop/models/seedance-2/')
    expect(screen.getByRole('link', { name: /Kling O3/ })).toBeTruthy()

    const browse = screen.getByRole('link', { name: 'Browse all models' })
    expect(browse.getAttribute('href')).toBe('/workshop')
  })

  it('hides the looping copy of the row from assistive tech', () => {
    render(ModelDiscoverySection)

    const visible = screen.getAllByRole('link', { name: /Seedance 2/ })
    const all = screen.getAllByRole('link', {
      name: /Seedance 2/,
      hidden: true
    })
    expect(visible).toHaveLength(1)
    expect(all).toHaveLength(2)
    expect(visible[0].getAttribute('tabindex')).toBeNull()
    expect(all[1].getAttribute('tabindex')).toBe('-1')
  })

  it('localizes copy while keeping the English-only Workshop route', () => {
    render(ModelDiscoverySection, { props: { locale: 'zh-CN' } })

    const browse = screen.getByRole('link', { name: '浏览全部模型' })
    expect(browse.getAttribute('href')).toBe('/workshop')
  })
})
